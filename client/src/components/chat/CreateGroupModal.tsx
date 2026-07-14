import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { searchUsers } from '../../api/users';
import { createGroup } from '../../api/conversations';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';
import type { UserProfile } from '../../types/user';

interface Props {
  onClose: () => void;
}

export default function CreateGroupModal({ onClose }: Props) {
  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserProfile[]>([]);
  const [selected, setSelected] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { setActiveConversation, setShowSidebar } = useChat();
  const { user } = useAuth();
  const queryClient = useQueryClient();

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
        const picked = new Set([user?.id, ...selected.map((s) => s.id)]);
        setResults(users.filter((u) => !picked.has(u.id)));
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, selected, user?.id]);

  function toggle(user: UserProfile) {
    setSelected((prev) =>
      prev.some((s) => s.id === user.id) ? prev.filter((s) => s.id !== user.id) : [...prev, user]
    );
    setQuery('');
    setResults([]);
  }

  const createMutation = useMutation({
    mutationFn: () =>
      createGroup({
        name: name.trim(),
        participantIds: selected.map((s) => s.id),
      }),
    onSuccess: (conv) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setActiveConversation(conv as any);
      setShowSidebar(false);
      onClose();
    },
    onError: (err: any) => {
      setError(err?.response?.data?.error || 'Failed to create group');
    },
  });

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-[var(--bg-primary)] shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-[var(--border-color)] px-5 py-4">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">New group</h2>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)]"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            <input
              ref={inputRef}
              type="text"
              placeholder="Group name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mb-4 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-2.5 text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-telegram-blue focus:shadow-[0_0_0_3px_rgba(42,171,238,0.12)]"
            />

            {selected.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-2">
                {selected.map((s) => (
                  <span
                    key={s.id}
                    className="flex items-center gap-1.5 rounded-full bg-telegram-blue/15 px-3 py-1 text-sm text-telegram-blue"
                  >
                    {s.displayName}
                    <button onClick={() => toggle(s)} className="font-bold">
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            <input
              type="text"
              placeholder="Add members…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="mb-3 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-2.5 text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-telegram-blue focus:shadow-[0_0_0_3px_rgba(42,171,238,0.12)]"
            />

            {loading && <p className="px-1 text-sm text-[var(--text-muted)]">Searching…</p>}

            <div className="space-y-0.5">
              {results.map((u) => (
                <button
                  key={u.id}
                  onClick={() => toggle(u)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[var(--hover-overlay)]"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-telegram-blue text-sm font-bold text-white">
                    {u.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-[var(--text-primary)]">{u.displayName}</p>
                    <p className="truncate text-sm text-[var(--text-secondary)]">@{u.username}</p>
                  </div>
                </button>
              ))}
            </div>

            {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
          </div>

          <div className="border-t border-[var(--border-color)] p-4">
            <button
              onClick={() => createMutation.mutate()}
              disabled={!name.trim() || selected.length === 0 || createMutation.isPending}
              className="w-full rounded-xl bg-telegram-blue py-2.5 font-medium text-white transition-colors hover:bg-[#2499d4] disabled:opacity-40"
            >
              {createMutation.isPending ? 'Creating…' : `Create group (${selected.length})`}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
