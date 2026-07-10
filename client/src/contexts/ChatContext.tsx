import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import type { Conversation } from '../types/conversation';
import type { User } from '../types/auth';

interface ChatContextType {
  activeConversation: Conversation | null;
  setActiveConversation: (conv: Conversation | null) => void;
  showSidebar: boolean;
  setShowSidebar: (show: boolean) => void;
}

const ChatContext = createContext<ChatContextType | null>(null);

function mergeUser(participant: User, u: Partial<User>): User {
  return {
    ...participant,
    avatarUrl: u.avatarUrl !== undefined ? u.avatarUrl : participant.avatarUrl,
    displayName: u.displayName !== undefined ? u.displayName : participant.displayName,
    username: u.username !== undefined ? u.username : participant.username,
    bio: u.bio !== undefined ? u.bio : participant.bio,
    publicKey: u.publicKey !== undefined ? u.publicKey : participant.publicKey,
  };
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const { socket } = useSocket();
  const { user, updateUser } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket) return;

    const handler = (u: Partial<User> & { id: string }) => {
      if (u.id === user?.id) updateUser(u);

      queryClient.setQueryData<Conversation[]>(['conversations'], (old) => {
        if (!old) return old;
        return old.map((c) => ({
          ...c,
          participants: c.participants.map((p) => (p.id === u.id ? mergeUser(p, u) : p)),
        }));
      });

      setActiveConversation((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          participants: prev.participants.map((p) => (p.id === u.id ? mergeUser(p, u) : p)),
        };
      });
    };

    socket.on('chat:user_updated', handler);
    return () => {
      socket.off('chat:user_updated', handler);
    };
  }, [socket, user?.id, queryClient, updateUser]);

  return (
    <ChatContext.Provider
      value={{ activeConversation, setActiveConversation, showSidebar, setShowSidebar }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
}
