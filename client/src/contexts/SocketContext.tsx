import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { getAccessToken } from '../api/client';
import { useAuth } from './AuthContext';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
  onlineUsers: Set<string>;
  typingUsers: Map<string, { userId: string; username: string }>;
}

const SocketContext = createContext<SocketContextType | null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<
    Map<string, { userId: string; username: string }>
  >(new Map());
  const typingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const token = getAccessToken();
    if (!token || !user) return;

    const s = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));

    // Re-verify on reconnect with fresh token
    s.on('reconnect_attempt', () => {
      const freshToken = getAccessToken();
      if (freshToken) {
        s.auth = { token: freshToken };
      }
    });

    s.on('user:online', ({ userId }: { userId: string }) => {
      setOnlineUsers((prev) => new Set(prev).add(userId));
    });

    // Replace the set with the server's authoritative snapshot of who is
    // currently online, sent on (re)connect.
    s.on('user:presence', ({ users }: { users: string[] }) => {
      setOnlineUsers(new Set(users));
    });

    s.on('user:offline', ({ userId }: { userId: string }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    });

    s.on('chat:typing', (data: { conversationId: string; userId: string; username: string }) => {
      const key = `${data.conversationId}:${data.userId}`;
      setTypingUsers((prev) => {
        const next = new Map(prev);
        next.set(key, { userId: data.userId, username: data.username });
        return next;
      });

      if (typingTimers.current.has(key)) {
        clearTimeout(typingTimers.current.get(key)!);
      }
      typingTimers.current.set(
        key,
        setTimeout(() => {
          setTypingUsers((prev) => {
            const next = new Map(prev);
            next.delete(key);
            return next;
          });
          typingTimers.current.delete(key);
        }, 3000)
      );
    });

    s.on('chat:stop_typing', (data: { conversationId: string; userId: string }) => {
      const key = `${data.conversationId}:${data.userId}`;
      setTypingUsers((prev) => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
      if (typingTimers.current.has(key)) {
        clearTimeout(typingTimers.current.get(key)!);
        typingTimers.current.delete(key);
      }
    });

    setSocket(s);

    return () => {
      s.close();
    };
  }, [user]);

  return (
    <SocketContext.Provider value={{ socket, connected, onlineUsers, typingUsers }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used within SocketProvider');
  return ctx;
}
