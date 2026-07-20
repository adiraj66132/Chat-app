import { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useConversations } from '../../hooks/useConversations';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { useCrypto } from '../../contexts/CryptoContext';
import { deleteConversation, leaveGroup } from '../../api/conversations';
import Avatar from '../Avatar';
import type { Conversation } from '../../types/conversation';
import { fadeUp, containerStagger } from '../../animations/motion';
import { pop } from '../../animations/anime';
import { getOtherUser } from '../../utils/conversation';

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(date).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function ConversationItem({
  conv,
  isActive,
  isOnline,
  onSelect,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
  confirmDelete,
  deleting,
  currentUserId,
}: {
  conv: Conversation;
  isActive: boolean;
  isOnline: boolean;
  onSelect: () => void;
  onRequestDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  confirmDelete: boolean;
  deleting: boolean;
  currentUserId?: string;
}) {
  const { decryptMessage } = useCrypto();
  const other = getOtherUser(conv, currentUserId);
  const isGroup = conv.type === 'GROUP';
  const name = conv.name || other?.displayName || 'Unknown';
  const last = conv.lastMessage;

  // Decrypt the last-message preview asynchronously. Encrypted messages carry an
  // `iv`; without decryption the sidebar would show raw ciphertext.
  const [preview, setPreview] = useState<string>('');
  useEffect(() => {
    let cancelled = false;
    if (last?.content) {
      decryptMessage(conv.id, last.content, last.iv).then((t) => {
        if (!cancelled) setPreview(t ?? '');
      });
    } else if (last?.fileUrl) {
      setPreview(last.fileName ? `📎 ${last.fileName}` : '📎 Attachment');
    } else {
      setPreview('');
    }
    return () => {
      cancelled = true;
    };
  }, [conv.id, last?.content, last?.iv, last?.fileUrl, last?.fileName, decryptMessage]);

  const lastMsg = preview;
  const ts = last?.createdAt || conv.updatedAt;

  const badgeRef = useRef<HTMLDivElement>(null);
  const prevCount = useRef(conv.unreadCount);
  useEffect(() => {
    if (conv.unreadCount > prevCount.current && badgeRef.current) {
      pop(badgeRef.current);
    }
    prevCount.current = conv.unreadCount;
  }, [conv.unreadCount]);

  if (confirmDelete) {
    return (
      <div className={`flex items-center gap-3 px-4 py-3 ${isActive ? 'bg-telegram-blue/10' : ''}`}>
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20 text-red-500">
          {isGroup ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          ) : (
            <span className="text-sm font-bold">×</span>
          )}
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-[var(--text-primary)]">
            {isGroup ? 'Leave' : 'Delete'} <span className="font-semibold">{name}</span>?
          </p>
          <p className="text-xs text-[var(--text-secondary)]">
            {isGroup ? "You'll stop receiving its messages" : 'All messages will be removed'}
          </p>
        </div>
        <div className="flex gap-1">
          <button
            onClick={onConfirmDelete}
            disabled={deleting}
            className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50"
          >
            {deleting ? '…' : isGroup ? 'Leave' : 'Delete'}
          </button>
          <button
            onClick={onCancelDelete}
            disabled={deleting}
            className="rounded-lg px-3 py-1.5 text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-overlay)] disabled:opacity-50"
          >
            {isGroup ? 'Stay' : 'Keep'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`group relative flex w-full items-center transition-colors ${
        isActive ? 'bg-telegram-blue/10' : 'hover:bg-[var(--hover-overlay)]'
      }`}
    >
      <button
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left"
      >
        <div className="relative shrink-0">
          {isGroup ? (
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-telegram-blue/15 text-xl text-telegram-blue">
              👥
            </div>
          ) : (
            <Avatar name={name} avatarUrl={other?.avatarUrl} size={48} />
          )}
          {!isGroup && isOnline && (
            <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[var(--bg-sidebar)] bg-green-500" />
          )}
        </div>
        <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between">
          <p className="truncate font-medium text-[var(--text-primary)]">{name}</p>
          {ts && (
            <span className="ml-2 shrink-0 text-[10px] text-[var(--text-muted)]">
              {timeAgo(ts)}
            </span>
          )}
        </div>
        {lastMsg && (
          <p className="truncate text-left text-sm text-[var(--text-secondary)]">
            {lastMsg}
          </p>
        )}
      </div>
      {conv.unreadCount > 0 && (
        <div ref={badgeRef} className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-telegram-blue px-1.5 text-[11px] font-bold text-white">
          {conv.unreadCount > 4 ? '4+' : conv.unreadCount}
        </div>
      )}
      </button>
      <button
        onClick={onRequestDelete}
        title={isGroup ? 'Leave group' : 'Delete conversation'}
        aria-label={isGroup ? 'Leave group' : 'Delete conversation'}
        className="mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] opacity-0 transition-opacity hover:bg-red-500/15 hover:text-red-500 focus:opacity-100 group-hover:opacity-100"
      >
        {isGroup ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
        )}
      </button>
    </div>
  );
}

export default function ConversationList() {
  const { data: conversations, isLoading } = useConversations();
  const { activeConversation, setActiveConversation, setShowSidebar } = useChat();
  const { user } = useAuth();
  const { socket, onlineUsers } = useSocket();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket) return;
    const handleRead = () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    };
    socket.on('chat:read_receipt', handleRead);
    return () => { socket.off('chat:read_receipt', handleRead); };
  }, [socket, queryClient]);

  const deleteMutation = useMutation({
    // DMs are deleted; groups are left via the dedicated endpoint (deleting a
    // group conversation server-side only removes you as a participant, which
    // is exactly "leave" — but we route explicitly so socket events fire).
    mutationFn: (conv: Conversation) =>
      conv.type === 'GROUP' ? leaveGroup(conv.id).then(() => {}) : deleteConversation(conv.id),
    onSuccess: (_data, conv) => {
      // If the removed conversation was open, close it so ChatView doesn't
      // keep rendering a stale/removed conversation.
      if (activeConversation?.id === conv.id) setActiveConversation(null);
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setConfirmDelete(null);
    },
    onError: () => {
      // Drop out of the confirm state so the row is interactive again instead
      // of getting stuck showing the "…" spinner forever.
      setConfirmDelete(null);
    },
  });

  if (isLoading) {
    return (
      <div className="flex-1 space-y-2 p-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex animate-pulse items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-[var(--border-color)]" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-1/3 rounded bg-[var(--border-color)]" />
              <div className="h-2 w-2/3 rounded bg-[var(--border-color)]" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <motion.div
      variants={containerStagger(0.04)}
      initial="hidden"
      animate="visible"
      className="flex-1 overflow-y-auto"
    >
      {(!conversations || conversations.length === 0) && (
        <div className="p-8 text-center text-sm text-[var(--text-secondary)]">
          <p>No conversations yet</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">Search for users to start chatting</p>
        </div>
      )}
      {conversations?.map((conv) => {
        const other = getOtherUser(conv, user?.id);
        const isOnline = other ? onlineUsers.has(other.id) : false;
        const isActive = activeConversation?.id === conv.id;

        return (
          <motion.div key={conv.id} variants={fadeUp}>
            <ConversationItem
              conv={conv}
              isActive={isActive}
              isOnline={isOnline}
              currentUserId={user?.id}
              onSelect={() => { setActiveConversation(conv); setShowSidebar(false); }}
              onRequestDelete={() => setConfirmDelete(conv.id)}
              onConfirmDelete={() => deleteMutation.mutate(conv)}
              onCancelDelete={() => setConfirmDelete(null)}
              confirmDelete={confirmDelete === conv.id}
              deleting={deleteMutation.isPending && confirmDelete === conv.id}
            />
          </motion.div>
        );
      })}
    </motion.div>
  );
}
