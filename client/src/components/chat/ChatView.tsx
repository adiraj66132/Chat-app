import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useChat } from '../../contexts/ChatContext';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';
import { clearConversationMessages } from '../../api/conversations';
import MessageList from './MessageList';
import ComposeBar from './ComposeBar';
import GroupSettingsPanel from './GroupSettingsPanel';
import PinnedBanner from './PinnedBanner';
import { getOtherUser } from '../../utils/conversation';
import { fadeIn, easeOut } from '../../animations/motion';
import Avatar from '../Avatar';

export default function ChatView() {
  const { activeConversation, setShowSidebar } = useChat();
  const { onlineUsers } = useSocket();
  const { user } = useAuth();
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    setShowGroupSettings(false);
    setShowMenu(false);
  }, [activeConversation?.id]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleClearChat = async () => {
    if (!activeConversation) return;
    await clearConversationMessages(activeConversation.id);
    queryClient.invalidateQueries({ queryKey: ['messages', activeConversation.id] });
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
    setShowMenu(false);
  };

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
  const isGroup = activeConversation.type === 'GROUP';
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
          {isGroup ? (
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-telegram-blue/15 text-lg text-telegram-blue">
              👥
            </div>
          ) : (
            <>
              <Avatar name={name} avatarUrl={other?.avatarUrl} size={40} />
              {isOnline && (
                <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[var(--bg-sidebar)] bg-green-500" />
              )}
            </>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-[var(--text-primary)]">{name}</p>
          <p className="text-xs text-[var(--text-secondary)]">
            {isGroup
              ? `${activeConversation.participants.length} members`
              : isOnline
                ? 'online'
                : 'offline'}
          </p>
        </div>
        {isGroup && (
          <button
            onClick={() => setShowGroupSettings(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-overlay)]"
            title="Group info"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          </button>
        )}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowMenu((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-overlay)]"
            title="More"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="1"/><circle cx="5" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full z-50 mt-1 min-w-[140px] overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] py-1 shadow-lg">
              <button
                onClick={handleClearChat}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-500 transition-colors hover:bg-[var(--hover-overlay)]"
              >
                Clear chat
              </button>
            </div>
          )}
        </div>
      </div>

      <PinnedBanner conversationId={activeConversation.id} />
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

      {showGroupSettings && activeConversation.type === 'GROUP' && (
        <GroupSettingsPanel
          conversation={activeConversation}
          onClose={() => setShowGroupSettings(false)}
        />
      )}
    </div>
  );
}
