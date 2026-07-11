import { prisma } from '../config/db';
import { AppError } from '../utils/AppError';

export async function listConversations(userId: string) {
  const participants = await prisma.conversationParticipant.findMany({
    where: { userId },
    include: {
      conversation: {
        include: {
          participants: {
            include: {
              user: {
                select: { id: true, username: true, displayName: true, avatarUrl: true, publicKey: true },
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

  const results = participants.map((p) => ({
    id: p.conversation.id,
    type: p.conversation.type,
    name: p.conversation.name,
    avatarUrl: p.conversation.avatarUrl,
    lastMessage: p.conversation.messages[0] || null,
    unreadCount: unreadMap.get(p.conversation.id) ?? 0,
    participants: p.conversation.participants.map((cp) => cp.user),
    updatedAt: p.conversation.messages[0]?.createdAt || p.conversation.createdAt,
  }));

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

export async function deleteMyKey(conversationId: string, userId: string) {
  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  if (!participant) throw new AppError('Not a participant', 403);

  await prisma.conversationKey.deleteMany({
    where: { conversationId, userId },
  });
}

export async function getMyKey(conversationId: string, userId: string) {
  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  if (!participant) throw new AppError('Not a participant', 403);

  const key = await prisma.conversationKey.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    select: { wrappedKey: true },
  });
  return key?.wrappedKey ?? null;
}

export async function putKeys(
  conversationId: string,
  requesterId: string,
  keys: { userId: string; wrappedKey: string }[]
) {
  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId: requesterId } },
  });
  if (!participant) throw new AppError('Not a participant', 403);

  // Only store wrapped keys for actual participants of this conversation.
  const participantIds = new Set(
    (
      await prisma.conversationParticipant.findMany({
        where: { conversationId },
        select: { userId: true },
      })
    ).map((p) => p.userId)
  );

  await prisma.$transaction(
    keys
      .filter((k) => participantIds.has(k.userId))
      .map((k) =>
        prisma.conversationKey.upsert({
          where: { conversationId_userId: { conversationId, userId: k.userId } },
          create: { conversationId, userId: k.userId, wrappedKey: k.wrappedKey },
          update: { wrappedKey: k.wrappedKey },
        })
      )
  );
}
