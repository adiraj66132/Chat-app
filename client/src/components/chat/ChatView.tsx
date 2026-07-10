import { motion, AnimatePresence } from 'motion/react';
import { useChat } from '../../contexts/ChatContext';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';
import MessageList from './MessageList';
import ComposeBar from './ComposeBar';
import { getOtherUser } from '../../utils/conversation';
import { fadeIn, easeOut } from '../../animations/motion';

export default function ChatView() {
  const { activeConversation, setShowSidebar } = useChat();
  const { onlineUsers } = useSocket();
  const { user } = useAuth();

  if (!activeConversation) {
    return (
      <div className="flex flex-1 select-none flex-col items-center justify-center gap-2 px-4 text-center text-sm text-[var(--text-secondary)]">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.4 }}
          transition={{ type: 'spring', stiffness: 200, damping: 16 }}
          className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--bg-surface)] text-2xl"
        >
          💬
        </motion.div>
        <p>Select a conversation to start chatting</p>
      </div>
    );
  }

  const other = getOtherUser(activeConversation, user?.id);
  const name = activeConversation.name || other?.displayName || 'Chat';
  const isOnline = other ? onlineUsers.has(other.id) : false;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b border-[var(--border-color)] bg-[var(--bg-sidebar)] px-4 py-3">
        <button
          onClick={() => setShowSidebar(true)}
          className="text-[var(--text-secondary)] md:hidden"
          aria-label="Open conversations"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="12" y2="18"/></svg>
        </button>
        <div className="relative shrink-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-telegram-blue text-sm font-bold text-white">
            {name.charAt(0).toUpperCase()}
          </div>
          {isOnline && (
            <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[var(--bg-sidebar)] bg-green-500" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-[var(--text-primary)]">{name}</p>
          <p className="text-xs text-[var(--text-secondary)]">
            {isOnline ? 'online' : 'offline'}
          </p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeConversation.id}
          initial="hidden"
          animate="visible"
          exit="hidden"
          variants={fadeIn}
          transition={easeOut}
          className="flex min-h-0 flex-1 flex-col"
        >
          <MessageList conversationId={activeConversation.id} />
          <ComposeBar conversationId={activeConversation.id} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
