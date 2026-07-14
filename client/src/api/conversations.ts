import { apiRequest } from './client';
import type { Conversation, GroupMember, ParticipantRole } from '../types/conversation';

export async function listConversations(): Promise<Conversation[]> {
  return apiRequest<Conversation[]>('/api/conversations');
}

export async function createConversation(participantId: string): Promise<Conversation> {
  return apiRequest<Conversation>('/api/conversations', {
    method: 'POST',
    body: JSON.stringify({ participantId }),
  });
}

export interface CreateGroupInput {
  name: string;
  description?: string;
  avatarUrl?: string;
  participantIds: string[];
}

export async function createGroup(input: CreateGroupInput): Promise<Conversation> {
  return apiRequest<Conversation>('/api/conversations/group', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getGroupMembers(id: string): Promise<GroupMember[]> {
  return apiRequest<GroupMember[]>(`/api/conversations/${id}/members`);
}

export async function addGroupMembers(id: string, userIds: string[]): Promise<Conversation> {
  return apiRequest<Conversation>(`/api/conversations/${id}/members`, {
    method: 'POST',
    body: JSON.stringify({ userIds }),
  });
}

export async function removeGroupMember(id: string, userId: string): Promise<void> {
  await apiRequest(`/api/conversations/${id}/members/${userId}`, { method: 'DELETE' });
}

export async function updateGroup(
  id: string,
  data: { name?: string; description?: string | null; avatarUrl?: string | null }
): Promise<Conversation> {
  return apiRequest<Conversation>(`/api/conversations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function changeGroupRole(
  id: string,
  userId: string,
  role: ParticipantRole
): Promise<void> {
  await apiRequest(`/api/conversations/${id}/members/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

export async function leaveGroup(id: string): Promise<{ deleted: boolean }> {
  return apiRequest<{ deleted: boolean }>(`/api/conversations/${id}/leave`, { method: 'POST' });
}

export async function getConversation(id: string): Promise<Conversation> {
  return apiRequest<Conversation>(`/api/conversations/${id}`);
}

export async function deleteConversation(id: string): Promise<void> {
  await apiRequest(`/api/conversations/${id}`, { method: 'DELETE' });
}

export async function clearConversationMessages(id: string): Promise<void> {
  await apiRequest(`/api/conversations/${id}/messages`, { method: 'DELETE' });
}
