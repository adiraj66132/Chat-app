import { Server as SocketIOServer } from 'socket.io';
import { prisma } from '../config/db';

let ioRef: SocketIOServer | null = null;

export function setIO(io: SocketIOServer) {
  ioRef = io;
}

export function emitToAll(event: string, payload: unknown) {
  ioRef?.emit(event, payload);
}

// Each connected socket also joins a room keyed by its userId (see socket/index.ts),
// so we can target a specific user's sockets directly.
export function emitToUser(userId: string, event: string, payload: unknown) {
  ioRef?.to(userId).emit(event, payload);
}

export function emitToRoom(room: string, event: string, payload: unknown) {
  ioRef?.to(room).emit(event, payload);
}

// Join every currently-connected socket of each conversation participant to the
// Socket.IO room, so real-time broadcasts (chat:new_message, etc.) reach them.
// The server only auto-joins rooms on initial socket connect; conversations
// created/extended while a peer is already online would otherwise miss the room
// and never receive live updates. Must be called after the participant rows
// exist in the DB.
export async function joinRoomForParticipants(conversationId: string) {
  if (!ioRef) return;
  const participants = await prisma.conversationParticipant.findMany({
    where: { conversationId },
    select: { userId: true },
  });
  const room = `conversation:${conversationId}`;
  for (const { userId } of participants) {
    // Each user's sockets joined a personal room keyed by userId on connect.
    const sockets = await ioRef.in(userId).fetchSockets();
    for (const s of sockets) s.join(room);
  }
}
