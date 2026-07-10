import { Server as SocketIOServer, type Socket } from 'socket.io';
import { verifyAccessToken, type TokenPayload } from '../utils/jwt';
import { prisma } from '../config/db';
import * as onlineService from '../services/onlineService';
import { registerChatHandlers } from './handlers/chat';
import { setIO } from './emitter';

interface AuthSocket extends Socket {
  userId?: string;
  username?: string;
}

export function setupSocket(io: SocketIOServer) {
  setIO(io);

  io.use((socket: AuthSocket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const payload = verifyAccessToken(token) as TokenPayload;
      socket.userId = payload.userId;
      socket.username = payload.username;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', async (socket: AuthSocket) => {
    const userId = socket.userId!;
    const username = socket.username!;

    // Track online
    onlineService.addUser(userId, socket.id);
    io.emit('user:online', { userId });

    // Send the newly-connected socket a snapshot of everyone currently
    // online, so its presence state is accurate from the start (otherwise a
    // user connecting after others are already online would see them as offline).
    const snapshot = onlineService.getOnlineUsers().filter((id) => id !== userId);
    socket.emit('user:presence', { users: snapshot });

    await prisma.user.update({
      where: { id: userId },
      data: { lastSeenAt: new Date() },
    });

    // Auto-join all user's conversation rooms
    const participants = await prisma.conversationParticipant.findMany({
      where: { userId },
      select: { conversationId: true },
    });

    // Also join global chat
    const globalChat = await prisma.conversation.findFirst({
      where: { type: 'GLOBAL' },
    });

    for (const p of participants) {
      socket.join(`conversation:${p.conversationId}`);
    }
    if (globalChat) {
      socket.join(`conversation:${globalChat.id}`);
    }

    // Register chat event handlers
    registerChatHandlers(io, socket, userId, username);

    socket.on('disconnect', async () => {
      const wasOnline = onlineService.removeSocket(socket.id);
      if (!wasOnline) {
        io.emit('user:offline', { userId });
        await prisma.user.update({
          where: { id: userId },
          data: { lastSeenAt: new Date() },
        });
      }
    });
  });
}
