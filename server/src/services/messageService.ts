import sanitizeHtml from 'sanitize-html';
import { prisma } from '../config/db';
import { AppError } from '../utils/AppError';

const MESSAGE_LIMIT = 35;

export async function getMessages(conversationId: string, userId: string, cursor?: string) {
  // Fetch the conversation and the caller's participant row in one round-trip.
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      participants: { where: { userId }, select: { clearedAt: true }, take: 1 },
    },
  });

  if (!conversation) throw new AppError('Conversation not found', 404);

  let clearedAt: Date | null = null;
  if (conversation.type !== 'GLOBAL') {
    const participant = conversation.participants[0];
    if (!participant) throw new AppError('Not a participant', 403);
    clearedAt = participant.clearedAt;
  }

  const where: any = { conversationId, deletedAt: null, NOT: { deletedByIds: { has: userId } } };
  if (clearedAt) where.createdAt = { gt: clearedAt };

  const messages = await prisma.message.findMany({
    where,
    take: MESSAGE_LIMIT + 1,
    orderBy: { createdAt: 'desc' },
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      sender: {
        select: { id: true, username: true, displayName: true, avatarUrl: true },
      },
      replyTo: {
        select: { id: true, content: true, sender: { select: { id: true, displayName: true } } },
      },
      reactions: {
        include: {
          user: { select: { id: true, username: true } },
        },
      },
    },
  });

  const hasMore = messages.length > MESSAGE_LIMIT;
  if (hasMore) messages.pop();

  return {
    messages: messages.reverse(),
    nextCursor: hasMore ? messages[0]?.id : null,
  };
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  data: {
    content?: string;
    type?: string;
    replyToId?: string;
    fileUrl?: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    iv?: string;
  }
) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      participants: { where: { userId: senderId }, select: { id: true }, take: 1 },
    },
  });

  if (!conversation) throw new AppError('Conversation not found', 404);

  if (conversation.type !== 'GLOBAL' && conversation.participants.length === 0) {
    throw new AppError('Not a participant', 403);
  }

  if (data.replyToId) {
    const replyTo = await prisma.message.findFirst({
      where: { id: data.replyToId, conversationId },
    });
    if (!replyTo) throw new AppError('Message to reply to not found', 404);
  }

  const content = data.content ?? null;

  const message = await prisma.message.create({
    data: {
      conversationId,
      senderId,
      content,
      type: (data.type as any) || 'TEXT',
      replyToId: data.replyToId || null,
      fileUrl: data.fileUrl || null,
      fileName: data.fileName || null,
      fileSize: data.fileSize || null,
      mimeType: data.mimeType || null,
      iv: data.iv || null,
    },
    include: {
      sender: {
        select: { id: true, username: true, displayName: true, avatarUrl: true },
      },
      replyTo: {
        select: { id: true, content: true, sender: { select: { id: true, displayName: true } } },
      },
      reactions: {
        include: {
          user: { select: { id: true, username: true } },
        },
      },
    },
  });

  // Update conversation's updatedAt
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  return message;
}

export async function editMessage(messageId: string, userId: string, content: string) {
  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message) throw new AppError('Message not found', 404);
  if (message.senderId !== userId) throw new AppError('Not your message', 403);
  if (message.deletedAt) throw new AppError('Message is deleted', 400);

  const sanitized = sanitizeHtml(content, { allowedTags: [], allowedAttributes: {} });
  const updated = await prisma.message.update({
    where: { id: messageId },
    data: { content: sanitized, editedAt: new Date() },
    include: {
      sender: {
        select: { id: true, username: true, displayName: true, avatarUrl: true },
      },
    },
  });

  return updated;
}

export async function searchMessages(userId: string, query: string) {
  const myIds = await prisma.conversationParticipant.findMany({
    where: { userId },
    select: { conversationId: true },
  });

  const messages = await prisma.message.findMany({
    where: {
      conversationId: { in: myIds.map((p) => p.conversationId) },
      content: { contains: query, mode: 'insensitive' },
      deletedAt: null,
      NOT: { deletedByIds: { has: userId } },
    },
    orderBy: { createdAt: 'desc' },
    take: 30,
    include: {
      sender: { select: { id: true, username: true, displayName: true } },
      conversation: { select: { id: true, type: true, name: true } },
    },
  });

  return messages.map((m) => ({
    id: m.id,
    content: m.content,
    createdAt: m.createdAt,
    sender: m.sender,
    conversationId: m.conversationId,
    conversation: m.conversation,
  }));
}

export async function pinMessage(messageId: string, userId: string) {
  const msg = await prisma.message.findUnique({ where: { id: messageId } });
  if (!msg) throw new AppError('Message not found', 404);
  // Fetch conversation + caller's participant row together.
  const conv = await prisma.conversation.findUnique({
    where: { id: msg.conversationId },
    include: { participants: { where: { userId }, select: { role: true }, take: 1 } },
  });
  if (!conv || conv.type !== 'GROUP') throw new AppError('Can only pin in groups', 400);
  const p = conv.participants[0];
  if (!p || (p.role !== 'OWNER' && p.role !== 'ADMIN')) throw new AppError('Forbidden', 403);

  await prisma.pinnedMessage.upsert({
    where: { conversationId_messageId: { conversationId: msg.conversationId, messageId } },
    create: { conversationId: msg.conversationId, messageId, pinnedBy: userId },
    update: { pinnedBy: userId, pinnedAt: new Date() },
  });
}

export async function unpinMessage(messageId: string, userId: string) {
  const msg = await prisma.message.findUnique({ where: { id: messageId } });
  if (!msg) throw new AppError('Message not found', 404);
  const conv = await prisma.conversation.findUnique({
    where: { id: msg.conversationId },
    include: { participants: { where: { userId }, select: { role: true }, take: 1 } },
  });
  if (!conv || conv.type !== 'GROUP') throw new AppError('Can only unpin in groups', 400);
  const p = conv.participants[0];
  if (!p || (p.role !== 'OWNER' && p.role !== 'ADMIN')) throw new AppError('Forbidden', 403);

  await prisma.pinnedMessage.deleteMany({
    where: { conversationId: msg.conversationId, messageId },
  });
}

export async function getPinnedMessages(conversationId: string, userId: string) {
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { participants: { where: { userId }, select: { id: true }, take: 1 } },
  });
  if (!conv) throw new AppError('Conversation not found', 404);
  if (conv.type !== 'GROUP') return [];
  if (conv.participants.length === 0) throw new AppError('Not a participant', 403);

  const pinned = await prisma.pinnedMessage.findMany({
    where: { conversationId },
    orderBy: { pinnedAt: 'desc' },
    include: {
      message: {
        include: {
          sender: { select: { id: true, username: true, displayName: true } },
        },
      },
      pinnedByUser: { select: { id: true, username: true, displayName: true } },
    },
  });
  return pinned;
}

export async function forwardMessage(messageId: string, userId: string, targetConversationId: string) {
  const original = await prisma.message.findUnique({ where: { id: messageId } });
  if (!original) throw new AppError('Message not found', 404);
  if (!original.content && !original.fileUrl) throw new AppError('Nothing to forward', 400);

  // User must be participant in both conversations.
  for (const cid of [original.conversationId, targetConversationId]) {
    const conv = await prisma.conversation.findUnique({
      where: { id: cid },
      include: { participants: { where: { userId }, select: { id: true }, take: 1 } },
    });
    if (!conv) throw new AppError('Conversation not found', 404);
    if (conv.type !== 'GLOBAL' && conv.participants.length === 0) {
      throw new AppError('Not a participant', 403);
    }
  }

  const message = await prisma.message.create({
    data: {
      conversationId: targetConversationId,
      senderId: userId,
      content: original.content,
      type: original.type || 'TEXT',
      status: 'SENT',
      fileUrl: original.fileUrl,
      fileName: original.fileName,
      fileSize: original.fileSize,
      mimeType: original.mimeType,
      iv: original.iv,
    },
    include: {
      sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
    },
  });

  await prisma.conversation.update({
    where: { id: targetConversationId },
    data: { updatedAt: new Date() },
  });

  return message;
}

export async function deleteMessage(messageId: string, userId: string) {
  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message) throw new AppError('Message not found', 404);
  if (message.senderId !== userId) throw new AppError('Not your message', 403);

  await prisma.message.update({
    where: { id: messageId },
    data: { deletedByIds: { push: userId } },
  });
}

// Mark a message delivered (used by the socket layer when another recipient is
// present in the room). Returns the updated row or null if already delivered.
export async function markDelivered(messageId: string) {
  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message || message.status === 'DELIVERED' || message.status === 'READ') return message;
  return prisma.message.update({
    where: { id: messageId },
    data: { status: 'DELIVERED', deliveredAt: new Date() },
  });
}

// Advance the caller's read pointer, then recompute which messages are now
// "read by everyone else" and mark those READ. A message's global READ status
// therefore means every *other* participant has read past it — so in a group,
// one member reading no longer flips the sender's checkmarks to READ until all
// have. Returns, per sender, the timestamp up to which their messages are now
// fully read, so the socket layer can tell that sender's client precisely which
// of their messages to update.
export async function markRead(
  conversationId: string,
  userId: string,
  messageId: string
): Promise<{
  updates: { senderId: string; upTo: Date }[];
  target: { id: string; conversationId: string; createdAt: Date } | null;
}> {
  const target = await prisma.message.findUnique({
    where: { id: messageId },
    select: { id: true, conversationId: true, senderId: true, createdAt: true },
  });
  if (!target || target.conversationId !== conversationId) {
    throw new AppError('Invalid messageId', 400);
  }

  // Advance this user's read pointer.
  await prisma.conversationParticipant.updateMany({
    where: { conversationId, userId },
    data: { lastReadAt: new Date() },
  });

  // Recompute "read by all others" per sender. For a sender S, their messages
  // are fully read up to the *minimum* lastReadAt across all participants != S.
  const participants = await prisma.conversationParticipant.findMany({
    where: { conversationId },
    select: { userId: true, lastReadAt: true },
  });

  const EPOCH = new Date(0);
  const readAt = new Date();
  const updates: { senderId: string; upTo: Date }[] = [];

  for (const sender of participants) {
    const others = participants.filter((p) => p.userId !== sender.userId);
    if (others.length === 0) continue;
    // A null lastReadAt means "never read" — treat as epoch so it gates READ.
    let minOthers = others[0].lastReadAt ?? EPOCH;
    for (const o of others) {
      const t = o.lastReadAt ?? EPOCH;
      if (t < minOthers) minOthers = t;
    }
    if (minOthers <= EPOCH) continue;

    const res = await prisma.message.updateMany({
      where: {
        conversationId,
        senderId: sender.userId,
        status: { not: 'READ' },
        createdAt: { lte: minOthers },
      },
      data: { status: 'READ', readAt },
    });
    if (res.count > 0) updates.push({ senderId: sender.userId, upTo: minOthers });
  }

  return { updates, target };
}
