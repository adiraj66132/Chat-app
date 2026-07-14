import { Server as SocketIOServer, type Socket } from 'socket.io';
import { prisma } from '../../config/db';
import { sendMessageSchema } from '../../validation/message';
import sanitizeHtml from 'sanitize-html';

const TYPING_TIMEOUT = 3000;
const typingTimers = new Map<string, NodeJS.Timeout>();

function roomName(conversationId: string) {
  return `conversation:${conversationId}`;
}

export function registerChatHandlers(
  io: SocketIOServer,
  socket: Socket,
  userId: string,
  username: string
) {
  socket.on('chat:join', ({ conversationId }: { conversationId: string }) => {
    socket.join(roomName(conversationId));
  });

  socket.on('chat:leave', ({ conversationId }: { conversationId: string }) => {
    socket.leave(roomName(conversationId));
  });

  // Send a message
  socket.on(
    'chat:send',
    async (
      data: {
        conversationId: string;
        content?: string;
        replyToId?: string;
        type?: string;
        fileUrl?: string;
        fileName?: string;
        fileSize?: number;
        mimeType?: string;
      },
      ack?: (response: { ok: boolean; message?: any; error?: string }) => void
    ) => {
      try {
        const parsed = sendMessageSchema.safeParse(data);
        if (!parsed.success) {
          const errorMsg = parsed.error.errors[0]?.message || 'Invalid message data';
          ack?.({ ok: false, error: errorMsg });
          socket.emit('chat:error', { message: errorMsg });
          return;
        }

        const conversation = await prisma.conversation.findUnique({
          where: { id: data.conversationId },
        });
        if (!conversation) {
          ack?.({ ok: false, error: 'Conversation not found' });
          socket.emit('chat:error', { message: 'Conversation not found' });
          return;
        }

        if (conversation.type !== 'GLOBAL') {
          const participant = await prisma.conversationParticipant.findUnique({
            where: {
              conversationId_userId: {
                conversationId: data.conversationId,
                userId,
              },
            },
          });
          if (!participant) {
            ack?.({ ok: false, error: 'Not a participant' });
            socket.emit('chat:error', { message: 'Not a participant' });
            return;
          }
        }

        const message = await prisma.message.create({
          data: {
            conversationId: data.conversationId,
            senderId: userId,
            content: data.content ?? null,
            type: (data.type as any) || 'TEXT',
            status: 'SENT',
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
              select: {
                id: true,
                content: true,
                sender: { select: { id: true, displayName: true } },
              },
            },
            reactions: {
              include: { user: { select: { id: true, username: true } } },
            },
          },
        });

        await prisma.conversation.update({
          where: { id: data.conversationId },
          data: { updatedAt: new Date() },
        });

        // Acknowledge to sender
        ack?.({ ok: true, message });

        // Broadcast to all in room (including sender)
        io.to(roomName(data.conversationId)).emit('chat:new_message', message);

        // Check if anyone else is in the room — if so, mark as delivered
        const room = io.sockets.adapter.rooms.get(roomName(data.conversationId));
        if (room && room.size > 1) {
          const updated = await prisma.message.update({
            where: { id: message.id },
            data: { status: 'DELIVERED', deliveredAt: new Date() },
          });
          io.to(roomName(data.conversationId)).emit('chat:status_update', {
            messageId: updated.id,
            conversationId: updated.conversationId,
            status: updated.status,
            deliveredAt: updated.deliveredAt,
          });
        }
      } catch (err) {
        console.error('Socket send error:', err);
        ack?.({ ok: false, error: 'Failed to send message' });
        socket.emit('chat:error', { message: 'Failed to send message' });
      }
    }
  );

  // Edit message
  socket.on(
    'chat:edit',
    async (data: { messageId: string; content: string }) => {
      try {
        const message = await prisma.message.findUnique({
          where: { id: data.messageId },
        });
        if (!message || message.senderId !== userId) {
          socket.emit('chat:error', { message: 'Cannot edit this message' });
          return;
        }

        const sanitizedContent = sanitizeHtml(data.content, { allowedTags: [], allowedAttributes: {} });
        const updated = await prisma.message.update({
          where: { id: data.messageId },
          data: { content: sanitizedContent, editedAt: new Date() },
        });

        io.to(roomName(message.conversationId)).emit('chat:edited', {
          messageId: data.messageId,
          conversationId: message.conversationId,
          content: data.content,
          editedAt: updated.editedAt,
        });
      } catch (err) {
        console.error('Socket edit error:', err);
        socket.emit('chat:error', { message: 'Failed to edit message' });
      }
    }
  );

  // Delete message
  socket.on('chat:delete', async (data: { messageId: string }) => {
    try {
      const message = await prisma.message.findUnique({
        where: { id: data.messageId },
      });
      if (!message || message.senderId !== userId) {
        socket.emit('chat:error', { message: 'Cannot delete this message' });
        return;
      }

      await prisma.message.update({
        where: { id: data.messageId },
        data: { deletedByIds: { push: userId } },
      });

      socket.emit('chat:deleted', {
        messageId: data.messageId,
        conversationId: message.conversationId,
      });
    } catch (err) {
      console.error('Socket delete error:', err);
      socket.emit('chat:error', { message: 'Failed to delete message' });
    }
  });

  // Typing indicators
  socket.on('chat:typing', ({ conversationId }: { conversationId: string }) => {
    socket
      .to(roomName(conversationId))
      .emit('chat:typing', { conversationId, userId, username });

    const key = `${userId}:${conversationId}`;
    if (typingTimers.has(key)) clearTimeout(typingTimers.get(key)!);
    typingTimers.set(
      key,
      setTimeout(() => {
        socket
          .to(roomName(conversationId))
          .emit('chat:stop_typing', { conversationId, userId });
        typingTimers.delete(key);
      }, TYPING_TIMEOUT)
    );
  });

  socket.on('chat:stop_typing', ({ conversationId }: { conversationId: string }) => {
    const key = `${userId}:${conversationId}`;
    if (typingTimers.has(key)) {
      clearTimeout(typingTimers.get(key)!);
      typingTimers.delete(key);
    }
    socket
      .to(roomName(conversationId))
      .emit('chat:stop_typing', { conversationId, userId });
  });

  // Read receipts — mark all unread messages as READ
  socket.on(
    'chat:mark_read',
    async (data: { conversationId: string; messageId: string }) => {
      try {
        // Update participant's lastReadAt
        await prisma.conversationParticipant.updateMany({
          where: { conversationId: data.conversationId, userId },
          data: { lastReadAt: new Date() },
        });

        // Mark all unread messages in this conversation as READ
        const result = await prisma.message.updateMany({
          where: {
            conversationId: data.conversationId,
            senderId: { not: userId },
            status: { not: 'READ' },
          },
          data: { status: 'READ', readAt: new Date() },
        });

        if (result.count > 0) {
          io.to(roomName(data.conversationId)).emit('chat:read_receipt', {
            conversationId: data.conversationId,
            userId,
            messageId: data.messageId,
          });
          // Also emit status update for batch
          io.to(roomName(data.conversationId)).emit('chat:status_update', {
            conversationId: data.conversationId,
            userId,
            status: 'READ',
          });
        }
      } catch (err) {
        console.error('Socket mark_read error:', err);
      }
    }
  );
}
