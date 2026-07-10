import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Conversation } from '../types/conversation';

interface ChatContextType {
  activeConversation: Conversation | null;
  setActiveConversation: (conv: Conversation | null) => void;
  showSidebar: boolean;
  setShowSidebar: (show: boolean) => void;
}

const ChatContext = createContext<ChatContextType | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);

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
