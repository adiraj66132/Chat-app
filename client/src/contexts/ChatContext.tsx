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

    // --- Group lifecycle events ---
    const invalidate = (conversationId: string) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['group-members', conversationId] });
    };

    const onGroupCreated = (data: { conversation: { id: string } }) => {
      socket.emit('chat:join', { conversationId: data.conversation.id });
      invalidate(data.conversation.id);
    };

    const onMemberAdded = (data: { conversationId: string; conversation: Conversation }) => {
      invalidate(data.conversationId);
      setActiveConversation((prev) =>
        prev && prev.id === data.conversationId ? (data.conversation as Conversation) : prev
      );
    };

    const onMemberRemoved = (data: { conversationId: string; userId: string }) => {
      if (data.userId === user?.id) {
        socket.emit('chat:leave', { conversationId: data.conversationId });
        setActiveConversation((prev) => (prev?.id === data.conversationId ? null : prev));
      }
      invalidate(data.conversationId);
    };

    const onGroupUpdated = (data: {
      conversationId: string;
      name?: string;
      avatarUrl?: string;
      description?: string;
    }) => {
      invalidate(data.conversationId);
      setActiveConversation((prev) =>
        prev && prev.id === data.conversationId
          ? { ...prev, name: data.name, avatarUrl: data.avatarUrl, description: data.description }
          : prev
      );
    };

    const onRoleChanged = (data: { conversationId: string }) => invalidate(data.conversationId);

    const onMemberLeft = (data: { conversationId: string; userId: string }) => {
      if (data.userId === user?.id) {
        socket.emit('chat:leave', { conversationId: data.conversationId });
        setActiveConversation((prev) => (prev?.id === data.conversationId ? null : prev));
      }
      invalidate(data.conversationId);
    };

    socket.on('conversation:group-created', onGroupCreated);
    socket.on('group:member-added', onMemberAdded);
    socket.on('group:member-removed', onMemberRemoved);
    socket.on('group:updated', onGroupUpdated);
    socket.on('group:role-changed', onRoleChanged);
    socket.on('group:member-left', onMemberLeft);

    return () => {
      socket.off('chat:user_updated', handler);
      socket.off('conversation:group-created', onGroupCreated);
      socket.off('group:member-added', onMemberAdded);
      socket.off('group:member-removed', onMemberRemoved);
      socket.off('group:updated', onGroupUpdated);
      socket.off('group:role-changed', onRoleChanged);
      socket.off('group:member-left', onMemberLeft);
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
