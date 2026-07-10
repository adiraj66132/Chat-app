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

  if (conversation.type !== 'GLOBAL') {
    const participant = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!participant) throw new AppError('Not a participant', 403);
  }

  const messages = await prisma.message.findMany({
    where: { conversationId, deletedAt: null },
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
    iv?: string;
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

  // Content arrives pre-encrypted from the client (E2EE); the server only
  // ever stores ciphertext + IV and cannot read it, so no sanitization is
  // applied here (the client renders via React, which escapes by default).
  const content = data.content ?? null;

  const message = await prisma.message.create({
    data: {
      conversationId,
      senderId,
      content,
      type: (data.type as any) || 'TEXT',
      replyToId: data.replyToId || null,
      iv: data.iv || null,
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

export async function deleteMessage(messageId: string, userId: string) {
  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message) throw new AppError('Message not found', 404);
  if (message.senderId !== userId) throw new AppError('Not your message', 403);

  await prisma.message.update({
    where: { id: messageId },
    data: { deletedAt: new Date(), content: null },
  });
}
