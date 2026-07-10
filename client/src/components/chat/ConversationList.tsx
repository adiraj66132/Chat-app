import { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useConversations } from '../../hooks/useConversations';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { useCrypto } from '../../contexts/CryptoContext';
import { deleteConversation } from '../../api/conversations';
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
  onDelete,
  confirmDelete,
  deleting,
  currentUserId,
}: {
  conv: Conversation;
  isActive: boolean;
  isOnline: boolean;
  onSelect: () => void;
  onDelete: () => void;
  confirmDelete: boolean;
  deleting: boolean;
  currentUserId?: string;
}) {
  const other = getOtherUser(conv, currentUserId);
  const name = conv.name || other?.displayName || 'Unknown';
  const last = conv.lastMessage;
  const { ensureCEK, decryptMessage, keyVersion } = useCrypto();

  // Decrypt the last-message preview for end-to-end encrypted conversations.
  const encrypted = !!(last?.content && last?.iv);
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!encrypted) return;
    let cancelled = false;
    (async () => {
      await ensureCEK(conv);
      if (cancelled) return;
      const text = await decryptMessage(conv.id, last!.content, last!.iv);
      if (!cancelled && text) setPreview(text);
    })();
    return () => {
      cancelled = true;
    };
  }, [conv, last, encrypted, ensureCEK, decryptMessage, keyVersion]);

  let lastMsg: string;
  if (encrypted) {
    lastMsg = preview ?? '🔒 Encrypted message';
  } else if (last?.content) {
    lastMsg = last.content;
  } else if (last?.fileUrl) {
    lastMsg = last.fileName ? `📎 ${last.fileName}` : '📎 Attachment';
  } else {
    lastMsg = '';
  }
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
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20 text-sm font-bold text-red-500">
          ×
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-[var(--text-primary)]">
            Delete <span className="font-semibold">{name}</span>?
          </p>
          <p className="text-xs text-[var(--text-secondary)]">All messages will be removed</p>
        </div>
        <div className="flex gap-1">
          <button
            onClick={onDelete}
            disabled={deleting}
            className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50"
          >
            {deleting ? '…' : 'Delete'}
          </button>
          <button
            onClick={onSelect}
            className="rounded-lg px-3 py-1.5 text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-overlay)]"
          >
            Keep
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={onSelect}
      className={`group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
        isActive
          ? 'bg-telegram-blue/10'
          : 'hover:bg-[var(--hover-overlay)]'
      }`}
    >
      <div className="relative shrink-0">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-telegram-blue text-base font-bold text-white">
          {name.charAt(0).toUpperCase()}
        </div>
        {isOnline && (
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
    mutationFn: (id: string) => deleteConversation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
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
              onDelete={() => setConfirmDelete(conv.id)}
              confirmDelete={confirmDelete === conv.id}
              deleting={deleteMutation.isPending && confirmDelete === conv.id}
            />
          </motion.div>
        );
      })}
    </motion.div>
  );
}
