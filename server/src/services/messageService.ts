import sanitizeHtml from 'sanitize-html';
import { prisma } from '../config/db';
import { AppError } from '../utils/AppError';

const MESSAGE_LIMIT = 35;

export async function getMessages(conversationId: string, userId: string, cursor?: string) {
  // Verify user is participant (skip for global chat)
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });

  if (!conversation) throw new AppError('Conversation not found', 404);

  let clearedAt: Date | null = null;
  if (conversation.type !== 'GLOBAL') {
    const participant = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
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
  }
) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });

  if (!conversation) throw new AppError('Conversation not found', 404);

  if (conversation.type !== 'GLOBAL') {
    const participant = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId: senderId } },
    });
    if (!participant) throw new AppError('Not a participant', 403);
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
  // Only allow pinning in groups.
  const conv = await prisma.conversation.findUnique({ where: { id: msg.conversationId } });
  if (!conv || conv.type !== 'GROUP') throw new AppError('Can only pin in groups', 400);
  // Only OWNER/ADMIN can pin.
  const p = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId: msg.conversationId, userId } },
  });
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
  const conv = await prisma.conversation.findUnique({ where: { id: msg.conversationId } });
  if (!conv || conv.type !== 'GROUP') throw new AppError('Can only unpin in groups', 400);
  const p = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId: msg.conversationId, userId } },
  });
  if (!p || (p.role !== 'OWNER' && p.role !== 'ADMIN')) throw new AppError('Forbidden', 403);

  await prisma.pinnedMessage.deleteMany({
    where: { conversationId: msg.conversationId, messageId },
  });
}

export async function getPinnedMessages(conversationId: string, userId: string) {
  const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conv) throw new AppError('Conversation not found', 404);
  if (conv.type !== 'GROUP') return [];

  const p = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  if (!p) throw new AppError('Not a participant', 403);

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
    const conv = await prisma.conversation.findUnique({ where: { id: cid } });
    if (!conv) throw new AppError('Conversation not found', 404);
    if (conv.type !== 'GLOBAL') {
      const p = await prisma.conversationParticipant.findUnique({
        where: { conversationId_userId: { conversationId: cid, userId } },
      });
      if (!p) throw new AppError('Not a participant', 403);
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
