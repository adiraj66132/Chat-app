import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import ConversationList from './ConversationList';
import UserSearch from './UserSearch';
import { useChat } from '../../contexts/ChatContext';
import { slideInLeft, easeOut } from '../../animations/motion';

function SidebarContent() {
  const [searching, setSearching] = useState(false);
  const { setShowSidebar } = useChat();
  const navigate = useNavigate();

  return (
    <div className="flex h-full w-full flex-col bg-[var(--bg-sidebar)]">
      <div className="flex items-center justify-between border-b border-[var(--border-color)] px-4 py-3">
        <h1 className="text-lg font-bold text-[var(--text-primary)]">
          {searching ? 'New Chat' : 'Chats'}
        </h1>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSearching(!searching)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-telegram-blue transition-colors hover:bg-telegram-blue/10"
            title={searching ? 'Back' : 'New chat'}
          >
            {searching ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            )}
          </button>
          <button
            onClick={() => navigate('/settings')}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)]"
            title="Settings"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
          </button>
          <button
            onClick={() => setShowSidebar(false)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)] md:hidden"
            title="Close"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>

      {searching ? (
        <UserSearch onClose={() => setSearching(false)} />
      ) : (
        <ConversationList />
      )}
    </div>
  );
}

export default function Sidebar() {
  const { showSidebar, setShowSidebar } = useChat();

  return (
    <>
      {/* Desktop: static column */}
      <aside className="hidden w-80 shrink-0 border-r border-[var(--border-color)] md:block">
        <SidebarContent />
      </aside>

      {/* Mobile: slide-in overlay drawer */}
      <AnimatePresence>
        {showSidebar && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={easeOut}
              onClick={() => setShowSidebar(false)}
              className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[1px] md:hidden"
            />
            <motion.aside
              key="drawer"
              variants={slideInLeft}
              initial="hidden"
              animate="visible"
              exit="hidden"
              transition={{ type: 'spring', stiffness: 340, damping: 34 }}
              className="fixed inset-y-0 left-0 z-40 w-[85%] max-w-xs border-r border-[var(--border-color)] md:hidden"
            >
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
