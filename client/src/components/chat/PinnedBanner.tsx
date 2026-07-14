import { useQuery } from '@tanstack/react-query';
import { getPinnedMessages, unpinMessage, type PinnedEntry } from '../../api/messages';
import { useChat } from '../../contexts/ChatContext';
import { useQueryClient } from '@tanstack/react-query';
import { formatText } from '../../utils/markdown';

interface Props {
  conversationId: string;
}

export default function PinnedBanner({ conversationId }: Props) {
  const { activeConversation } = useChat();
  const queryClient = useQueryClient();
  const isGroup = activeConversation?.type === 'GROUP';

  const { data: pinned = [] } = useQuery({
    queryKey: ['pinned', conversationId],
    queryFn: () => getPinnedMessages(conversationId),
    enabled: isGroup,
  });

  if (pinned.length === 0) return null;

  const handleUnpin = async (entry: PinnedEntry) => {
    await unpinMessage(entry.messageId);
    queryClient.invalidateQueries({ queryKey: ['pinned', conversationId] });
  };

  return (
    <div className="border-b border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-2">
      {pinned.slice(0, 1).map((entry) => (
        <div key={entry.id} className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
          <span className="shrink-0">📌</span>
          <span className="truncate flex-1">
            <span className="font-medium text-[var(--text-primary)]">{entry.pinnedByUser.displayName}</span>
            {' pinned "'}
            {formatText(entry.message.content ?? '')}
            {'"'}
          </span>
          <button
            onClick={() => handleUnpin(entry)}
            className="shrink-0 text-[var(--text-muted)] hover:text-red-500"
            title="Unpin"
          >
            ✕
          </button>
        </div>
      ))}
      {pinned.length > 1 && (
        <p className="mt-1 text-[11px] text-[var(--text-muted)]">+{pinned.length - 1} more pinned messages</p>
      )}
    </div>
  );
}
