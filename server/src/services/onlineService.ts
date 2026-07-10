const onlineUsers = new Map<string, Set<string>>();

export function addUser(userId: string, socketId: string) {
  const sockets = onlineUsers.get(userId) || new Set();
  sockets.add(socketId);
  onlineUsers.set(userId, sockets);
}

export function removeUser(userId: string, socketId: string) {
  const sockets = onlineUsers.get(userId);
  if (!sockets) return false;
  sockets.delete(socketId);
  if (sockets.size === 0) {
    onlineUsers.delete(userId);
    return false; // user fully offline
  }
  return true; // user still online on another device
}

export function isUserOnline(userId: string): boolean {
  return onlineUsers.has(userId);
}

export function getOnlineUsers(): string[] {
  return Array.from(onlineUsers.keys());
}

export function removeSocket(socketId: string): string | null {
  for (const [userId, sockets] of onlineUsers.entries()) {
    if (sockets.has(socketId)) {
      sockets.delete(socketId);
      if (sockets.size === 0) {
        onlineUsers.delete(userId);
        return userId;
      }
      return null; // still online on other device
    }
  }
  return null;
}
