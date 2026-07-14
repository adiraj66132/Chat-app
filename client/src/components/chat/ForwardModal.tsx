import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useConversations } from '../../hooks/useConversations';
import { useAuth } from '../../contexts/AuthContext';
import { forwardMessage } from '../../api/messages';
import Avatar from '../Avatar';
import { getOtherUser } from '../../utils/conversation';
import type { Conversation } from '../../types/conversation';

interface Props {
  messageId: string;
  onClose: () => void;
}

export default function ForwardModal({ messageId, onClose }: Props) {
  const { data: conversations } = useConversations();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (targetConversationId: string) => forwardMessage(messageId, targetConversationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      onClose();
    },
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[70vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-[var(--bg-primary)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-[var(--border-color)] px-5 py-4">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Forward message</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations?.map((conv: Conversation) => {
            const name = conv.name || getOtherUser(conv, user?.id)?.displayName || 'Chat';
            return (
              <button
                key={conv.id}
                onClick={() => mutation.mutate(conv.id)}
                disabled={mutation.isPending}
                className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-[var(--hover-overlay)] disabled:opacity-50"
              >
                <Avatar name={name} size={40} />
                <span className="truncate font-medium text-[var(--text-primary)]">{name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
