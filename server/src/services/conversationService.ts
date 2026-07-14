import { prisma } from '../config/db';
import { AppError } from '../utils/AppError';
import type { MemberRole } from '@prisma/client';

export async function listConversations(userId: string) {
  const participants = await prisma.conversationParticipant.findMany({
    where: { userId },
    include: {
      conversation: {
        include: {
          participants: {
            include: {
              user: {
                select: { id: true, username: true, displayName: true, avatarUrl: true },
              },
            },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              sender: {
                select: { id: true, username: true, displayName: true },
              },
            },
          },
        },
      },
    },
    orderBy: { joinedAt: 'desc' },
  });

  // Single query for all unread counts (fixes N+1)
  type UnreadRow = { conversationId: string; unread: bigint };
  const unreadRows = await prisma.$queryRaw<UnreadRow[]>`
    SELECT cp.conversation_id as "conversationId", COUNT(m.id)::int8 as unread
    FROM conversation_participants cp
    LEFT JOIN messages m ON m.conversation_id = cp.conversation_id
      AND m.sender_id <> ${userId}::uuid
      AND m.deleted_at IS NULL
      AND (cp.last_read_at IS NULL OR m.created_at > cp.last_read_at)
    WHERE cp.user_id = ${userId}::uuid
    GROUP BY cp.conversation_id
  `;
  const unreadMap = new Map(unreadRows.map((r) => [r.conversationId, Number(r.unread)]));

  const results = participants.map((p) => {
    const lastMsg = p.conversation.messages[0] || null;
    const filtered = lastMsg && p.clearedAt && new Date(lastMsg.createdAt) <= p.clearedAt ? null : lastMsg;
    return {
      id: p.conversation.id,
      type: p.conversation.type,
      name: p.conversation.name,
      avatarUrl: p.conversation.avatarUrl,
      lastMessage: filtered,
      unreadCount: unreadMap.get(p.conversation.id) ?? 0,
      participants: p.conversation.participants.map((cp) => cp.user),
      updatedAt: filtered?.createdAt || p.conversation.createdAt,
    };
  });

  return results.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export async function createDM(userId: string, participantId: string) {
  if (userId === participantId) {
    throw new AppError('Cannot create conversation with yourself', 400);
  }

  // Check existing DM
  const existing = await prisma.conversation.findFirst({
    where: {
      type: 'DM',
      AND: [
        { participants: { some: { userId } } },
        { participants: { some: { userId: participantId } } },
      ],
    },
    include: {
      participants: {
        include: {
          user: {
            select: { id: true, username: true, displayName: true, avatarUrl: true, publicKey: true },
          },
        },
      },
    },
  });

  if (existing) return existing;

  const conversation = await prisma.conversation.create({
    data: {
      type: 'DM',
      participants: {
        createMany: {
          data: [
            { userId, role: 'MEMBER' },
            { userId: participantId, role: 'MEMBER' },
          ],
        },
      },
    },
    include: {
      participants: {
        include: {
          user: {
            select: { id: true, username: true, displayName: true, avatarUrl: true, publicKey: true },
          },
        },
      },
    },
  });

  return conversation;
}

export async function getConversation(conversationId: string, userId: string) {
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      participants: { some: { userId } },
    },
    include: {
      participants: {
        include: {
          user: {
            select: { id: true, username: true, displayName: true, avatarUrl: true, publicKey: true },
          },
        },
      },
    },
  });

  if (!conversation) throw new AppError('Conversation not found', 404);
  return conversation;
}

export async function deleteConversation(conversationId: string, userId: string) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId },
  });

  if (!conversation) throw new AppError('Conversation not found', 404);
  if (conversation.type === 'GLOBAL') throw new AppError('Cannot delete global chat', 400);

  await prisma.conversationParticipant.deleteMany({
    where: { conversationId, userId },
  });

  // If no participants left, delete the conversation entirely
  const remaining = await prisma.conversationParticipant.count({
    where: { conversationId },
  });

  if (remaining === 0) {
    await prisma.conversation.delete({ where: { id: conversationId } });
  }
}

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

const userSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
} as const;

const groupInclude = {
  participants: {
    include: { user: { select: userSelect } },
    orderBy: { joinedAt: 'asc' },
  },
} as const;

async function getParticipant(conversationId: string, userId: string) {
  return prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
}

async function requireGroup(conversationId: string) {
  const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conv || conv.type !== 'GROUP') throw new AppError('Group not found', 404);
  return conv;
}

async function requireRole(
  conversationId: string,
  userId: string,
  roles: MemberRole[]
) {
  const p = await getParticipant(conversationId, userId);
  if (!p) throw new AppError('Not a participant', 403);
  if (!roles.includes(p.role)) throw new AppError('Forbidden', 403);
  return p;
}

export async function createGroupConversation(
  creatorId: string,
  data: { name: string; description?: string; avatarUrl?: string; participantIds: string[] }
) {
  const memberIds = Array.from(new Set(data.participantIds)).filter((id) => id !== creatorId);
  if (memberIds.length === 0) {
    throw new AppError('A group needs at least one other member', 400);
  }

  const known = await prisma.user.findMany({
    where: { id: { in: memberIds } },
    select: { id: true },
  });
  const unknown = memberIds.filter((id) => !known.some((u) => u.id === id));
  if (unknown.length) {
    throw new AppError(`Unknown user(s): ${unknown.join(', ')}`, 404);
  }

  return prisma.conversation.create({
    data: {
      type: 'GROUP',
      name: data.name,
      description: data.description ?? null,
      avatarUrl: data.avatarUrl ?? null,
      createdById: creatorId,
      participants: {
        create: [
          { userId: creatorId, role: 'OWNER' },
          ...memberIds.map((id) => ({ userId: id, role: 'MEMBER' as const })),
        ],
      },
    },
    include: groupInclude,
  });
}

export async function getGroupMembers(conversationId: string, userId: string) {
  await requireRole(conversationId, userId, ['OWNER', 'ADMIN', 'MEMBER']);
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: groupInclude,
  });
  return (
    conv?.participants.map((p) => ({
      user: p.user,
      role: p.role,
      joinedAt: p.joinedAt,
    })) ?? []
  );
}

export async function addParticipants(
  conversationId: string,
  requesterId: string,
  userIds: string[]
) {
  await requireGroup(conversationId);
  await requireRole(conversationId, requesterId, ['OWNER', 'ADMIN']);

  const ids = Array.from(new Set(userIds)).filter((id) => id !== requesterId);
  if (ids.length === 0) return getGroup(conversationId);

  const existing = await prisma.conversationParticipant.findMany({
    where: { conversationId, userId: { in: ids } },
    select: { userId: true },
  });
  const existingSet = new Set(existing.map((e) => e.userId));
  const toAdd = ids.filter((id) => !existingSet.has(id));
  if (toAdd.length === 0) return getGroup(conversationId);

  const known = await prisma.user.findMany({
    where: { id: { in: toAdd } },
    select: { id: true },
  });
  const unknown = toAdd.filter((id) => !known.some((u) => u.id === id));
  if (unknown.length) {
    throw new AppError(`Unknown user(s): ${unknown.join(', ')}`, 404);
  }

  await prisma.conversationParticipant.createMany({
    data: toAdd.map((id) => ({ conversationId, userId: id, role: 'MEMBER' as const })),
  });

  return getGroup(conversationId);
}

export async function removeParticipant(
  conversationId: string,
  requesterId: string,
  targetUserId: string
) {
  await requireGroup(conversationId);
  await requireRole(conversationId, requesterId, ['OWNER', 'ADMIN']);

  const target = await getParticipant(conversationId, targetUserId);
  if (!target) throw new AppError('User is not a member', 404);
  if (target.role === 'OWNER') throw new AppError('Cannot remove the owner', 400);

  await prisma.conversationParticipant.delete({
    where: { conversationId_userId: { conversationId, userId: targetUserId } },
  });
  return { removedUserId: targetUserId };
}

export async function updateGroupMeta(
  conversationId: string,
  requesterId: string,
  data: { name?: string; description?: string | null; avatarUrl?: string | null }
) {
  await requireGroup(conversationId);
  await requireRole(conversationId, requesterId, ['OWNER', 'ADMIN']);

  const update: Record<string, unknown> = {};
  if (data.name !== undefined) update.name = data.name;
  if (data.description !== undefined) update.description = data.description;
  if (data.avatarUrl !== undefined) update.avatarUrl = data.avatarUrl;

  return prisma.conversation.update({
    where: { id: conversationId },
    data: update,
    include: groupInclude,
  });
}

export async function changeRole(
  conversationId: string,
  requesterId: string,
  targetUserId: string,
  role: MemberRole
) {
  await requireGroup(conversationId);
  await requireRole(conversationId, requesterId, ['OWNER']);

  const target = await getParticipant(conversationId, targetUserId);
  if (!target) throw new AppError('User is not a member', 404);

  if (role === 'OWNER') {
    // Transfer ownership: target becomes OWNER, current owner steps down to ADMIN.
    await prisma.$transaction([
      prisma.conversationParticipant.update({
        where: { conversationId_userId: { conversationId, userId: requesterId } },
        data: { role: 'ADMIN' },
      }),
      prisma.conversationParticipant.update({
        where: { conversationId_userId: { conversationId, userId: targetUserId } },
        data: { role: 'OWNER' },
      }),
    ]);
  } else {
    if (target.role === 'OWNER') throw new AppError('Cannot change the owner role', 400);
    await prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId: targetUserId } },
      data: { role },
    });
  }
  return { userId: targetUserId, role };
}

export async function leaveGroup(conversationId: string, userId: string) {
  await requireGroup(conversationId);
  const me = await getParticipant(conversationId, userId);
  if (!me) throw new AppError('Not a member', 404);

  // Owner must transfer ownership before leaving if others remain.
  if (me.role === 'OWNER') {
    const remaining = await prisma.conversationParticipant.count({
      where: { conversationId, NOT: { userId } },
    });
    if (remaining > 0) {
      throw new AppError('Transfer ownership before leaving the group', 400);
    }
  }

  await prisma.conversationParticipant.delete({
    where: { conversationId_userId: { conversationId, userId } },
  });

  const remaining = await prisma.conversationParticipant.count({ where: { conversationId } });
  if (remaining === 0) {
    await prisma.conversation.delete({ where: { id: conversationId } });
    return { deleted: true };
  }
  return { deleted: false };
}

export async function clearConversationMessages(conversationId: string, userId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { type: true },
  });
  if (!conversation) throw new AppError('Conversation not found', 404);

  if (conversation.type !== 'GLOBAL') {
    const participant = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!participant) throw new AppError('Not a participant', 403);
  }

  await prisma.conversationParticipant.update({
    where: { conversationId_userId: { conversationId, userId } },
    data: { clearedAt: new Date() },
  });
}

async function getGroup(conversationId: string) {
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: groupInclude,
  });
  if (!conv) throw new AppError('Group not found', 404);
  return conv;
}
