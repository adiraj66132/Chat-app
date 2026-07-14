import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchMessages, type SearchResult } from '../../api/messages';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';
import { useConversations } from '../../hooks/useConversations';
import Avatar from '../Avatar';
import { getOtherUser } from '../../utils/conversation';

export default function MessageSearch() {
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { setActiveConversation, setShowSidebar } = useChat();
  const { user } = useAuth();
  const { data: conversations } = useConversations();
  const convMap = new Map(conversations?.map((c) => [c.id, c]) ?? []);

  const { data: results = [] } = useQuery({
    queryKey: ['message-search', q],
    queryFn: () => searchMessages(q),
    enabled: q.length >= 2,
  });

  useEffect(() => { inputRef.current?.focus(); }, []);

  function goTo(result: SearchResult) {
    const conv = convMap.get(result.conversationId);
    if (conv) {
      setActiveConversation(conv);
      setShowSidebar(false);
    }
  }

  return (
    <div className="flex flex-col">
      <div className="border-b border-[var(--border-color)] px-4 py-2">
        <input
          ref={inputRef}
          type="text"
          placeholder="Search messages…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-2.5 text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-telegram-blue"
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        {q.length < 2 && (
          <p className="p-4 text-center text-sm text-[var(--text-muted)]">Type at least 2 characters</p>
        )}
        {q.length >= 2 && results.length === 0 && (
          <p className="p-4 text-center text-sm text-[var(--text-muted)]">No results</p>
        )}
        {results.map((r) => {
          const conv = convMap.get(r.conversationId);
          const name = conv?.name || getOtherUser(conv, user?.id)?.displayName || 'Chat';
          return (
            <button
              key={r.id}
              onClick={() => goTo(r)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--hover-overlay)]"
            >
              <Avatar name={name} size={40} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-medium text-[var(--text-primary)]">
                    {name}
                  </span>
                  <span className="shrink-0 text-[10px] text-[var(--text-muted)]">
                    {new Date(r.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <p className="truncate text-sm text-[var(--text-secondary)]">
                  {r.sender.displayName}: {r.content}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
