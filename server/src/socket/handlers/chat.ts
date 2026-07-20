import { Server as SocketIOServer, type Socket } from 'socket.io';
import { prisma } from '../../config/db';
import { sendMessageSchema } from '../../validation/message';
import * as messageService from '../../services/messageService';
import * as onlineService from '../../services/onlineService';

const TYPING_TIMEOUT = 3000;
const typingTimers = new Map<string, NodeJS.Timeout>();

// Minimal per-connection rate limiter to blunt abuse of socket events.
const RATE_WINDOW_MS = 1000;
const RATE_MAX = 20;

async function rateLimited(socketId: string): Promise<boolean> {
  return onlineService.rateLimited(socketId, RATE_WINDOW_MS, RATE_MAX);
}

function roomName(conversationId: string) {
  return `conversation:${conversationId}`;
}

// Returns true if the user may participate in the conversation (GLOBAL is open
// to any authenticated user; otherwise they must be a participant).
async function isParticipant(conversationId: string, uid: string): Promise<boolean> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { type: true },
  });
  if (!conversation) return false;
  if (conversation.type === 'GLOBAL') return true;
  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId: uid } },
  });
  return !!participant;
}

export function registerChatHandlers(
  io: SocketIOServer,
  socket: Socket,
  userId: string,
  username: string
) {
  socket.on('chat:join', async ({ conversationId }: { conversationId: string }) => {
    if (!(await isParticipant(conversationId, userId))) {
      socket.emit('chat:error', { message: 'Not a participant' });
      return;
    }
    socket.join(roomName(conversationId));
  });

  socket.on('chat:leave', async ({ conversationId }: { conversationId: string }) => {
    if (!(await isParticipant(conversationId, userId))) {
      socket.emit('chat:error', { message: 'Not a participant' });
      return;
    }
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
          iv?: string;
        },
        ack?: (response: { ok: boolean; message?: any; error?: string }) => void
      ) => {
        if (await rateLimited(socket.id)) {
          ack?.({ ok: false, error: 'Too many requests' });
          return;
        }
        try {
        const parsed = sendMessageSchema.safeParse(data);
        if (!parsed.success) {
          const errorMsg = parsed.error.errors[0]?.message || 'Invalid message data';
          ack?.({ ok: false, error: errorMsg });
          socket.emit('chat:error', { message: errorMsg });
          return;
        }

        // Auth/membership checks (kept here, before calling the shared service).
        if (!(await isParticipant(data.conversationId, userId))) {
          ack?.({ ok: false, error: 'Not a participant' });
          socket.emit('chat:error', { message: 'Not a participant' });
          return;
        }

        let message;
        try {
          message = await messageService.sendMessage(data.conversationId, userId, {
            content: data.content,
            type: data.type,
            replyToId: data.replyToId,
            fileUrl: data.fileUrl,
            fileName: data.fileName,
            fileSize: data.fileSize,
            mimeType: data.mimeType,
            iv: data.iv,
          });
        } catch (err: any) {
          const errorMsg = err?.message || 'Failed to send message';
          ack?.({ ok: false, error: errorMsg });
          socket.emit('chat:error', { message: errorMsg });
          return;
        }

        // Acknowledge to sender
        ack?.({ ok: true, message });

        // Broadcast to all in room (including sender)
        io.to(roomName(data.conversationId)).emit('chat:new_message', message);

        // Check if anyone else is in the room — if so, mark as delivered
        const room = io.sockets.adapter.rooms.get(roomName(data.conversationId));
        if (room && room.size > 1) {
          const updated = await messageService.markDelivered(message.id);
          if (updated) {
            io.to(roomName(data.conversationId)).emit('chat:status_update', {
              messageId: updated.id,
              conversationId: updated.conversationId,
              status: updated.status,
              deliveredAt: updated.deliveredAt,
            });
          }
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
      if (await rateLimited(socket.id)) return;
      try {
        const updated = await messageService.editMessage(data.messageId, userId, data.content);

        io.to(roomName(updated.conversationId)).emit('chat:edited', {
          messageId: updated.id,
          conversationId: updated.conversationId,
          content: updated.content,
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
    if (await rateLimited(socket.id)) return;
    try {
      const message = await prisma.message.findUnique({
        where: { id: data.messageId },
        select: { conversationId: true, senderId: true },
      });
      if (!message || message.senderId !== userId) {
        socket.emit('chat:error', { message: 'Cannot delete this message' });
        return;
      }

      await messageService.deleteMessage(data.messageId, userId);

      io.to(roomName(message.conversationId)).emit('chat:deleted', {
        messageId: data.messageId,
        conversationId: message.conversationId,
      });
    } catch (err) {
      console.error('Socket delete error:', err);
      socket.emit('chat:error', { message: 'Failed to delete message' });
    }
  });

  // Typing indicators
  socket.on('chat:typing', async ({ conversationId }: { conversationId: string }) => {
    if (!(await isParticipant(conversationId, userId))) return;
    io.to(roomName(conversationId)).emit('chat:typing', { conversationId, userId, username });

    const key = `${userId}:${conversationId}`;
    if (typingTimers.has(key)) clearTimeout(typingTimers.get(key)!);
    typingTimers.set(
      key,
      setTimeout(() => {
        io.to(roomName(conversationId)).emit('chat:stop_typing', { conversationId, userId });
        typingTimers.delete(key);
      }, TYPING_TIMEOUT)
    );
  });

  socket.on('chat:stop_typing', async ({ conversationId }: { conversationId: string }) => {
    if (!(await isParticipant(conversationId, userId))) return;
    io.to(roomName(conversationId)).emit('chat:stop_typing', { conversationId, userId });
  });

  // Read receipts — mark all unread messages as READ
  socket.on(
    'chat:mark_read',
    async (data: { conversationId: string; messageId: string }) => {
      if (await rateLimited(socket.id)) return;
      try {
        if (!data.conversationId || !data.messageId) {
          socket.emit('chat:error', { message: 'conversationId and messageId are required' });
          return;
        }
        if (!(await isParticipant(data.conversationId, userId))) {
          socket.emit('chat:error', { message: 'Not a participant' });
          return;
        }

        const { updates } = await messageService.markRead(
          data.conversationId,
          userId,
          data.messageId
        );

        // Let everyone refresh unread counts / receipts for this reader.
        io.to(roomName(data.conversationId)).emit('chat:read_receipt', {
          conversationId: data.conversationId,
          userId,
          messageId: data.messageId,
        });

        // For each sender whose messages just became "read by all others",
        // tell that sender's client to flip those messages to READ. Global
        // READ now means every other participant has read past `upTo`.
        for (const u of updates) {
          io.to(roomName(data.conversationId)).emit('chat:status_update', {
            conversationId: data.conversationId,
            senderId: u.senderId,
            status: 'READ',
            upTo: u.upTo,
          });
        }
      } catch (err) {
        console.error('Socket mark_read error:', err);
      }
    }
  );
}
