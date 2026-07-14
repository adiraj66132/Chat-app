import { Server as SocketIOServer } from 'socket.io';

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
