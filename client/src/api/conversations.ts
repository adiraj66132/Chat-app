import { apiRequest } from './client';
import type { Conversation } from '../types/conversation';

export async function listConversations(): Promise<Conversation[]> {
  return apiRequest<Conversation[]>('/api/conversations');
}

export async function createConversation(participantId: string): Promise<Conversation> {
  return apiRequest<Conversation>('/api/conversations', {
    method: 'POST',
    body: JSON.stringify({ participantId }),
  });
}

export async function getConversation(id: string): Promise<Conversation> {
  return apiRequest<Conversation>(`/api/conversations/${id}`);
}

export async function deleteConversation(id: string): Promise<void> {
  await apiRequest(`/api/conversations/${id}`, { method: 'DELETE' });
}

export async function clearConversation(id: string): Promise<void> {
  await apiRequest(`/api/conversations/${id}`, { method: 'DELETE' });
}

export interface ConversationKeyEntry {
  userId: string;
  wrappedKey: string;
}

// Returns the wrapped CEK for the current user in this conversation (null if none yet).
export async function getConversationKeys(id: string): Promise<{ wrappedKey: string | null }> {
  return apiRequest<{ wrappedKey: string | null }>(`/api/conversations/${id}/keys`);
}

export async function putConversationKeys(
  id: string,
  keys: ConversationKeyEntry[]
): Promise<void> {
  await apiRequest(`/api/conversations/${id}/keys`, {
    method: 'PUT',
    body: JSON.stringify({ keys }),
  });
}

export async function deleteConversationKey(id: string): Promise<void> {
  await apiRequest(`/api/conversations/${id}/keys`, {
    method: 'DELETE',
  });
}
