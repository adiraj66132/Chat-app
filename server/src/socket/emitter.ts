import { Server as SocketIOServer } from 'socket.io';

let ioRef: SocketIOServer | null = null;

export function setIO(io: SocketIOServer) {
  ioRef = io;
}

export function emitToAll(event: string, payload: unknown) {
  ioRef?.emit(event, payload);
}
