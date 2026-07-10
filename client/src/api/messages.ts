import { apiRequest } from './client';
import type { Message, MessagesResponse, SendMessageInput } from '../types/conversation';

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

export async function deleteMessage(messageId: string): Promise<void> {
  await apiRequest(`/api/messages/${messageId}`, { method: 'DELETE' });
}
