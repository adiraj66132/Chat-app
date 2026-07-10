import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useQueryClient } from '@tanstack/react-query';
import { useMessages } from '../../hooks/useMessages';
import { useAuth } from '../../contexts/AuthContext';
import { useChat } from '../../contexts/ChatContext';
import { useSocket } from '../../contexts/SocketContext';
import { useCrypto } from '../../contexts/CryptoContext';
import type { Message } from '../../types/conversation';
import { messageBubble } from '../../animations/motion';
import { assetUrl } from '../../api/client';

function formatBytes(bytes?: number | null): string {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

interface Props {
  conversationId: string;
}

function StatusIcon({ status }: { status?: 'SENT' | 'DELIVERED' | 'READ' }) {
  if (!status || status === 'SENT') {
    return <span className="text-[10px] opacity-50">✓</span>;
  }
  if (status === 'DELIVERED') {
    return <span className="text-[10px] opacity-50">✓✓</span>;
  }
  return <span className="text-[10px] text-telegram-blue">✓✓</span>;
}

function DateSeparator({ date }: { date: string }) {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  let label: string;
  if (d.toDateString() === today.toDateString()) {
    label = 'Today';
  } else if (d.toDateString() === yesterday.toDateString()) {
    label = 'Yesterday';
  } else {
    label = d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
  }

  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex-1 border-t border-[var(--border-color)]" />
      <span className="shrink-0 text-[11px] font-medium text-[var(--text-muted)]">{label}</span>
      <div className="flex-1 border-t border-[var(--border-color)]" />
    </div>
  );
}

export default function MessageList({ conversationId }: Props) {
  const { user } = useAuth();
  const { activeConversation } = useChat();
  const { socket, typingUsers } = useSocket();
  const { decryptMessage, ensureCEK, keyVersion } = useCrypto();
  const bottomRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const lastReadIdRef = useRef<string | null>(null);
  const [decrypted, setDecrypted] = useState<Map<string, string>>(() => new Map());

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useMessages(conversationId);

  const allMessages = data?.pages.flatMap((p) => p.messages) ?? [];

  // Establish the conversation key when the conversation opens so we can
  // Establish the conversation key when the conversation opens so we can
  // decrypt incoming history and new messages. If the key isn't ready yet
  // (e.g. the other participant is the designated creator and hasn't opened
  // yet), retry a few times so we converge even when both sides open at once.
  useEffect(() => {
    if (!activeConversation || activeConversation.id !== conversationId) return;
    let cancelled = false;
    let attempt = 0;
    const tryEstablish = async () => {
      if (cancelled) return;
      const cek = await ensureCEK(activeConversation).catch(() => null);
      if (cek || cancelled) return;
      if (attempt++ < 4) {
        setTimeout(tryEstablish, 1500);
      }
    };
    tryEstablish();
    return () => {
      cancelled = true;
    };
  }, [activeConversation, conversationId, ensureCEK]);

  // Reset decryption cache when switching conversations.
  useEffect(() => {
    setDecrypted(new Map());
  }, [conversationId]);

  // Decrypt any encrypted messages (content + IV) for display.
  // Only successfully decrypted plaintext is cached; if a key isn't available
  // yet we leave it pending and re-attempt when `keyVersion` changes.
  useEffect(() => {
    let cancelled = false;
    const pending = allMessages.filter((m) => m.content && m.iv && !decrypted.has(m.id));
    if (pending.length === 0) return;
    let needKey = false;
    Promise.all(
      pending.map(async (m) => {
        const text = await decryptMessage(conversationId, m.content, m.iv);
        if (text === null) {
          needKey = true;
          return null;
        }
        return [m.id, text] as const;
      })
    ).then((results) => {
      if (cancelled) return;
      const resolved = results.filter((r): r is readonly [string, string] => r !== null);
      if (resolved.length > 0) {
        setDecrypted((prev) => {
          const next = new Map(prev);
          for (const [id, text] of resolved) next.set(id, text);
          return next;
        });
      }
      // If any message couldn't be decrypted (no key yet), try to obtain the
      // conversation key; once it arrives `keyVersion` bumps and we retry.
      if (needKey && activeConversation && activeConversation.id === conversationId) {
        ensureCEK(activeConversation).catch(() => {});
      }
    });
    return () => {
      cancelled = true;
    };
  }, [allMessages, conversationId, decryptMessage, decrypted, keyVersion, activeConversation, ensureCEK]);

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (message: Message) => {
      if (message.conversationId !== conversationId) return;
      queryClient.setQueryData(['messages', conversationId], (old: any) => {
        if (!old) return old;
        const pages = old.pages.map((p: any) => ({
          ...p,
          messages: p.messages.some((m: any) => m.id === message.id)
            ? p.messages
            : [...p.messages, message],
        }));
        return { ...old, pages };
      });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    };

    const handleStatusUpdate = (update: { messageId?: string; status: string; deliveredAt?: string; readAt?: string }) => {
      queryClient.setQueryData(['messages', conversationId], (old: any) => {
        if (!old) return old;
        const pages = old.pages.map((p: any) => ({
          ...p,
          messages: p.messages.map((m: any) => {
            if (update.messageId) {
              return m.id === update.messageId
                ? { ...m, status: update.status, deliveredAt: update.deliveredAt, readAt: update.readAt }
                : m;
            }
            if (update.status === 'READ' && m.senderId !== user?.id) {
              return { ...m, status: 'READ' as const, readAt: update.readAt };
            }
            return m;
          }),
        }));
        return { ...old, pages };
      });
    };

    const handleEdited = (update: { messageId: string; content: string; editedAt: string }) => {
      queryClient.setQueryData(['messages', conversationId], (old: any) => {
        if (!old) return old;
        const pages = old.pages.map((p: any) => ({
          ...p,
          messages: p.messages.map((m: any) =>
            m.id === update.messageId ? { ...m, content: update.content, editedAt: update.editedAt } : m
          ),
        }));
        return { ...old, pages };
      });
    };

    const handleDeleted = (update: { messageId: string }) => {
      queryClient.setQueryData(['messages', conversationId], (old: any) => {
        if (!old) return old;
        const pages = old.pages.map((p: any) => ({
          ...p,
          messages: p.messages.filter((m: any) => m.id !== update.messageId),
        }));
        return { ...old, pages };
      });
    };

    socket.on('chat:new_message', handleNewMessage);
    socket.on('chat:status_update', handleStatusUpdate);
    socket.on('chat:edited', handleEdited);
    socket.on('chat:deleted', handleDeleted);

    return () => {
      socket.off('chat:new_message', handleNewMessage);
      socket.off('chat:status_update', handleStatusUpdate);
      socket.off('chat:edited', handleEdited);
      socket.off('chat:deleted', handleDeleted);
    };
  }, [socket, conversationId, queryClient]);

  useEffect(() => {
    if (!socket || !conversationId || allMessages.length === 0) return;
    const lastMsg = allMessages[allMessages.length - 1];
    if (lastMsg.id === lastReadIdRef.current) return;
    if (lastMsg.senderId !== user?.id) {
      lastReadIdRef.current = lastMsg.id;
      socket.emit('chat:mark_read', {
        conversationId,
        messageId: lastMsg.id,
      });
    }
  }, [socket, conversationId, allMessages, user?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allMessages.length]);

  const typingForConv = Array.from(typingUsers.entries())
    .filter(([key]) => key.startsWith(conversationId + ':'))
    .map(([_, val]) => val.username);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-[var(--text-secondary)]">
        Loading messages...
      </div>
    );
  }

  // Build grouped messages with date separators
  const rows: Array<{ type: 'date'; date: string } | { type: 'msg'; msg: Message }> = [];
  let lastDate = '';
  for (const msg of allMessages) {
    const msgDate = new Date(msg.createdAt).toDateString();
    if (msgDate !== lastDate) {
      rows.push({ type: 'date', date: msg.createdAt });
      lastDate = msgDate;
    }
    rows.push({ type: 'msg', msg });
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-2">
      {hasNextPage && (
        <div className="py-2 text-center">
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="rounded-lg px-4 py-1.5 text-sm text-telegram-blue transition-colors hover:bg-telegram-blue/10 disabled:opacity-50"
          >
            {isFetchingNextPage ? 'Loading…' : 'Load older messages'}
          </button>
        </div>
      )}

      {allMessages.length === 0 && (
        <div className="flex h-full select-none flex-col items-center justify-center gap-2 text-sm text-[var(--text-secondary)]">
          <div className="text-3xl opacity-30">💬</div>
          <p>No messages yet</p>
          <p className="text-xs text-[var(--text-muted)]">Send a message to start the conversation</p>
        </div>
      )}

      {rows.map((row, i) => {
        if (row.type === 'date') {
          return <DateSeparator key={`date-${i}`} date={row.date} />;
        }
        const msg = row.msg;
        const isMine = msg.sender?.id === user?.id;
        return (
          <motion.div
            key={msg.id}
            layout="position"
            initial="hidden"
            animate="visible"
            variants={messageBubble}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className={`mb-1 flex ${isMine ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                isMine
                  ? 'rounded-br-sm bg-[var(--bubble-mine)] text-white'
                  : 'rounded-bl-sm bg-[var(--bubble-other)] text-[var(--text-primary)]'
              }`}
            >
              {!isMine && msg.sender && (
                <p className="mb-0.5 text-xs font-semibold text-telegram-blue">
                  {msg.sender.displayName}
                </p>
              )}
          {msg.replyTo && (
            <div className="mb-1 rounded-lg border-l-[3px] border-[var(--text-muted)] bg-black/10 px-2 py-1 text-xs text-[var(--text-secondary)]">
              <p className="font-medium">{msg.replyTo.sender.displayName}</p>
              <p className="truncate">{msg.iv ? '🔒 Encrypted message' : msg.replyTo.content}</p>
            </div>
          )}

          {msg.fileUrl && msg.type === 'IMAGE' && (
            <a
              href={assetUrl(msg.fileUrl)}
              target="_blank"
              rel="noreferrer"
              className="mb-1 block"
            >
              <img
                src={assetUrl(msg.fileUrl)}
                alt={msg.fileName || 'image'}
                className="max-h-72 w-auto rounded-lg object-cover"
              />
            </a>
          )}

          {msg.fileUrl && msg.type !== 'IMAGE' && (
            <a
              href={assetUrl(msg.fileUrl)}
              target="_blank"
              rel="noreferrer"
              download={msg.fileName}
              className="mb-1 flex items-center gap-3 rounded-lg bg-black/10 px-3 py-2 transition-colors hover:bg-black/20"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-telegram-blue/20 text-telegram-blue">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{msg.fileName}</span>
                <span className="block text-[10px] opacity-60">{formatBytes(msg.fileSize)}</span>
              </span>
            </a>
          )}

          {msg.content && (
            <p className="break-words text-sm leading-relaxed">
              {msg.iv ? (decrypted.get(msg.id) ?? '🔒') : msg.content}
            </p>
          )}
              <div className="mt-0.5 flex items-center justify-end gap-1">
                <span className="text-[10px] opacity-60">
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {msg.editedAt && ' (edited)'}
                </span>
                {isMine && msg.status && <StatusIcon status={msg.status} />}
              </div>
            </div>
          </motion.div>
        );
      })}

      <AnimatePresence>
        {typingForConv.length > 0 && (
          <motion.div
            key="typing"
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="mb-1 flex justify-start"
          >
            <div className="max-w-[75%] rounded-2xl rounded-bl-sm bg-[var(--bubble-other)] px-4 py-3">
              <p className="text-sm italic text-[var(--text-secondary)]">
                {typingForConv.join(', ')} typing<span className="animate-pulse">…</span>
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div ref={bottomRef} />
    </div>
  );
}
