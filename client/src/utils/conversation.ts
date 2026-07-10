import type { Conversation } from '../types/conversation';
import type { User } from '../types/auth';

// Resolve the participant at the *other* end of a conversation (not the
// current user). Falls back to participants[0] for groups / single-member DMs.
export function getOtherUser(conv: Conversation, currentUserId?: string): User | undefined {
  if (!conv.participants?.length) return undefined;
  return (
    conv.participants.find((p) => p.id !== currentUserId) ?? conv.participants[0]
  );
}
