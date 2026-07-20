import { Server as SocketIOServer, type Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { verifyAccessToken, type TokenPayload } from '../utils/jwt';
import { prisma } from '../config/db';
import * as onlineService from '../services/onlineService';
import { registerChatHandlers } from './handlers/chat';
import { setIO } from './emitter';

interface AuthSocket extends Socket {
  userId?: string;
  username?: string;
}

// Use the redis adapter when REDIS_URL is configured (horizontal scalability);
// otherwise fall back to the default in-memory adapter for local dev.
function configureAdapter(io: SocketIOServer) {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.warn('[socket] REDIS_URL not set — using in-memory adapter (single instance only)');
    return;
  }
  const pub = new Redis(redisUrl);
  const sub = pub.duplicate();
  io.adapter(createAdapter(pub, sub));
  console.log('[socket] redis adapter enabled');
}

export function setupSocket(io: SocketIOServer) {
  setIO(io);
  configureAdapter(io);

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
    // Join a personal room so the server can target this user's sockets directly
    // (used for group invites/removals).
    socket.join(userId);
    io.emit('user:online', { userId });

    // Send the newly-connected socket a snapshot of everyone currently
    // online, so its presence state is accurate from the start (otherwise a
    // user connecting after others are already online would see them as offline).
    const snapshot = (await onlineService.getOnlineUsers()).filter((id) => id !== userId);
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

    for (const p of participants) {
      socket.join(`conversation:${p.conversationId}`);
    }
    // NOTE: GLOBAL is intentionally NOT auto-joined here. It is opt-in — a user
    // joins it on demand via `chat:join` (isParticipant permits any authenticated
    // user into GLOBAL). Auto-joining it forced every user into a room they never
    // opted into.

    // Register chat event handlers
    registerChatHandlers(io, socket, userId, username);

    socket.on('disconnect', async () => {
      const wasOnline = await onlineService.removeSocket(socket.id);
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
