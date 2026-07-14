import { apiRequest } from './client';
import type { Message, MessagesResponse, SendMessageInput, Conversation } from '../types/conversation';

export interface SearchResult {
  id: string;
  content: string | null;
  createdAt: string;
  sender: { id: string; username: string; displayName: string };
  conversationId: string;
  conversation: Pick<Conversation, 'id' | 'type' | 'name'>;
}

export async function searchMessages(q: string): Promise<SearchResult[]> {
  return apiRequest<SearchResult[]>(`/api/messages/search?q=${encodeURIComponent(q)}`);
}

export async function getMessages(
  conversationId: string,
  cursor?: string
): Promise<MessagesResponse> {
  const params = cursor ? `?cursor=${cursor}` : '';
  return apiRequest<MessagesResponse>(
    `/api/conversations/${conversationId}/messages${params}`
  );
}

export async function sendMessage(
  conversationId: string,
  data: SendMessageInput
): Promise<Message> {
  return apiRequest<Message>(`/api/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function editMessage(messageId: string, content: string): Promise<Message> {
  return apiRequest<Message>(`/api/messages/${messageId}`, {
    method: 'PATCH',
    body: JSON.stringify({ content }),
  });
}

export async function pinMessage(messageId: string): Promise<void> {
  await apiRequest(`/api/messages/${messageId}/pin`, { method: 'POST' });
}

export async function unpinMessage(messageId: string): Promise<void> {
  await apiRequest(`/api/messages/${messageId}/pin`, { method: 'DELETE' });
}

export interface PinnedEntry {
  id: string;
  messageId: string;
  pinnedAt: string;
  pinnedByUser: { id: string; username: string; displayName: string };
  message: {
    id: string;
    content: string | null;
    sender: { id: string; username: string; displayName: string };
  };
}

export async function getPinnedMessages(conversationId: string): Promise<PinnedEntry[]> {
  return apiRequest<PinnedEntry[]>(`/api/conversations/${conversationId}/pinned`);
}

export async function deleteMessage(messageId: string): Promise<void> {
  await apiRequest(`/api/messages/${messageId}`, { method: 'DELETE' });
}

export async function forwardMessage(messageId: string, targetConversationId: string): Promise<Message> {
  return apiRequest<Message>(`/api/messages/${messageId}/forward`, {
    method: 'POST',
    body: JSON.stringify({ targetConversationId }),
  });
}
