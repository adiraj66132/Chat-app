import { useState, useEffect, useRef } from 'react';
import { searchUsers } from '../../api/users';
import { createConversation } from '../../api/conversations';
import { useChat } from '../../contexts/ChatContext';
import type { UserProfile } from '../../types/user';

interface Props {
  onClose: () => void;
}

export default function UserSearch({ onClose }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { setActiveConversation, setShowSidebar } = useChat();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (query.length < 1) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const users = await searchUsers(query);
        setResults(users);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  async function handleSelect(user: UserProfile) {
    try {
      const conv = await createConversation(user.id);
      setActiveConversation(conv as any);
      setShowSidebar(false);
      onClose();
    } catch (err) {
      console.error('Failed to create conversation', err);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <input
        ref={inputRef}
        type="text"
        placeholder="Search username…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mb-4 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-2.5 text-[var(--text-primary)] outline-none transition-shadow placeholder:text-[var(--text-muted)] focus:border-telegram-blue focus:shadow-[0_0_0_3px_rgba(42,171,238,0.12)]"
      />

      {loading && (
        <div className="flex animate-pulse items-center gap-3 px-3 py-2">
          <div className="h-10 w-10 rounded-full bg-[var(--border-color)]" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-1/3 rounded bg-[var(--border-color)]" />
            <div className="h-2 w-1/4 rounded bg-[var(--border-color)]" />
          </div>
        </div>
      )}

      {!loading && results.length === 0 && query.length >= 1 && (
        <p className="px-3 text-sm text-[var(--text-muted)]">No users found</p>
      )}

      <div className="space-y-0.5">
        {results.map((user) => (
          <button
            key={user.id}
            onClick={() => handleSelect(user)}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-[var(--hover-overlay)]"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-telegram-blue text-sm font-bold text-white">
              {user.displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 text-left">
              <p className="truncate font-medium text-[var(--text-primary)]">{user.displayName}</p>
              <p className="truncate text-sm text-[var(--text-secondary)]">@{user.username}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
