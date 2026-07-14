import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { searchUsers } from '../../api/users';
import {
  getGroupMembers,
  addGroupMembers,
  removeGroupMember,
  updateGroup,
  changeGroupRole,
  leaveGroup,
} from '../../api/conversations';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';
import type { Conversation, GroupMember, ParticipantRole } from '../../types/conversation';
import type { UserProfile } from '../../types/user';
import Avatar from '../Avatar';

interface Props {
  conversation: Conversation;
  onClose: () => void;
}

export default function GroupSettingsPanel({ conversation, onClose }: Props) {
  const id = conversation.id;
  const { user } = useAuth();
  const { setActiveConversation } = useChat();
  const queryClient = useQueryClient();
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(conversation.name ?? '');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['group-members', id],
    queryFn: () => getGroupMembers(id),
  });

  const me = members.find((m) => m.user.id === user?.id);
  const canManage = me?.role === 'OWNER' || me?.role === 'ADMIN';

  useEffect(() => {
    if (!editingName) setName(conversation.name ?? '');
  }, [conversation.name, editingName]);

  useEffect(() => {
    if (query.length < 1) {
      setResults([]);
      return;
    }
    const memberIds = new Set(members.map((m) => m.user.id));
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const users = await searchUsers(query);
        setResults(users.filter((u) => !memberIds.has(u.id) && u.id !== user?.id));
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, members, user?.id]);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['group-members', id] });
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
  }

  const addMutation = useMutation({
    mutationFn: (userIds: string[]) => addGroupMembers(id, userIds),
    onSuccess: () => {
      invalidate();
      setQuery('');
      setResults([]);
    },
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => removeGroupMember(id, userId),
    onSuccess: invalidate,
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: ParticipantRole }) =>
      changeGroupRole(id, userId, role),
    onSuccess: invalidate,
  });

  const renameMutation = useMutation({
    mutationFn: () => updateGroup(id, { name: name.trim() || conversation.name }),
    onSuccess: (conv) => {
      setEditingName(false);
      setActiveConversation(conv as any);
      invalidate();
    },
  });

  const leaveMutation = useMutation({
    mutationFn: () => leaveGroup(id),
    onSuccess: (res) => {
      invalidate();
      if (res.deleted) setActiveConversation(null);
      onClose();
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
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Group info</h2>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)]"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {editingName ? (
              <div className="mb-4 flex items-center gap-2">
                <input
                  ref={nameRef}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="flex-1 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-[var(--text-primary)] outline-none focus:border-telegram-blue"
                />
                <button
                  onClick={() => renameMutation.mutate()}
                  className="rounded-lg bg-telegram-blue px-3 py-2 text-sm font-medium text-white"
                >
                  Save
                </button>
              </div>
            ) : (
              <div className="mb-4 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold text-[var(--text-primary)]">
                    {conversation.name}
                  </p>
                  <p className="text-sm text-[var(--text-secondary)]">{members.length} members</p>
                </div>
                {canManage && (
                  <button
                    onClick={() => {
                      setEditingName(true);
                      setTimeout(() => nameRef.current?.focus(), 0);
                    }}
                    className="rounded-lg px-3 py-1.5 text-sm text-telegram-blue hover:bg-telegram-blue/10"
                  >
                    Rename
                  </button>
                )}
              </div>
            )}

            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Members
            </h3>
            {isLoading ? (
              <p className="text-sm text-[var(--text-muted)]">Loading…</p>
            ) : (
              <div className="space-y-0.5">
                {members.map((m: GroupMember) => (
                  <div
                    key={m.user.id}
                    className="flex items-center gap-3 rounded-xl px-2 py-2"
                  >
                    <Avatar name={m.user.displayName} avatarUrl={m.user.avatarUrl} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-[var(--text-primary)]">
                        {m.user.displayName}
                        {m.user.id === user?.id && (
                          <span className="ml-1 text-xs text-[var(--text-muted)]">(you)</span>
                        )}
                      </p>
                      <span className="text-xs text-[var(--text-secondary)]">{m.role}</span>
                    </div>
                    {canManage && m.role !== 'OWNER' && m.user.id !== user?.id && (
                      <div className="flex items-center gap-1">
                        {me?.role === 'OWNER' && (
                          <button
                            onClick={() => roleMutation.mutate({ userId: m.user.id, role: 'OWNER' })}
                            className="rounded-lg px-2 py-1 text-xs text-telegram-blue hover:bg-telegram-blue/10"
                            title="Make owner"
                          >
                            Owner
                          </button>
                        )}
                        {m.role === 'MEMBER' ? (
                          <button
                            onClick={() => roleMutation.mutate({ userId: m.user.id, role: 'ADMIN' })}
                            className="rounded-lg px-2 py-1 text-xs text-telegram-blue hover:bg-telegram-blue/10"
                          >
                            Admin
                          </button>
                        ) : (
                          <button
                            onClick={() => roleMutation.mutate({ userId: m.user.id, role: 'MEMBER' })}
                            className="rounded-lg px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)]"
                          >
                            Demote
                          </button>
                        )}
                        <button
                          onClick={() => removeMutation.mutate(m.user.id)}
                          className="rounded-lg px-2 py-1 text-xs text-red-500 hover:bg-red-500/10"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {canManage && (
              <div className="mt-4">
                <input
                  type="text"
                  placeholder="Add member…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="mb-2 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-2.5 text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-telegram-blue focus:shadow-[0_0_0_3px_rgba(42,171,238,0.12)]"
                />
                {loading && <p className="px-1 text-sm text-[var(--text-muted)]">Searching…</p>}
                <div className="space-y-0.5">
                  {results.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => addMutation.mutate([u.id])}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[var(--hover-overlay)]"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-telegram-blue text-sm font-bold text-white">
                        {u.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-[var(--text-primary)]">
                          {u.displayName}
                        </p>
                        <p className="truncate text-sm text-[var(--text-secondary)]">
                          @{u.username}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-[var(--border-color)] p-4">
            <button
              onClick={() => leaveMutation.mutate()}
              disabled={leaveMutation.isPending}
              className="w-full rounded-xl bg-red-500/10 py-2.5 font-medium text-red-500 transition-colors hover:bg-red-500/20 disabled:opacity-40"
            >
              Leave group
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
