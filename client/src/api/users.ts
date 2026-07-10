import { apiRequest } from './client';
import type { UserProfile, UpdateProfileInput } from '../types/user';

export async function getMe(): Promise<UserProfile> {
  return apiRequest<UserProfile>('/api/users/me');
}

export async function getUserById(id: string): Promise<UserProfile> {
  return apiRequest<UserProfile>(`/api/users/${id}`);
}

export async function searchUsers(q: string): Promise<UserProfile[]> {
  return apiRequest<UserProfile[]>(`/api/users/search?q=${encodeURIComponent(q)}`);
}

export async function updateProfile(data: UpdateProfileInput): Promise<UserProfile> {
  return apiRequest<UserProfile>('/api/users/me', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function updateAvatar(file: File): Promise<UserProfile> {
  const formData = new FormData();
  formData.append('avatar', file);
  return apiRequest<UserProfile>('/api/users/me/avatar', {
    method: 'POST',
    body: formData,
  });
}

export async function updateTheme(theme: string): Promise<{ id: string; theme: string }> {
  return apiRequest('/api/users/me/theme', {
    method: 'PATCH',
    body: JSON.stringify({ theme }),
  });
}

export async function setPublicKey(publicKey: string): Promise<UserProfile> {
  return apiRequest<UserProfile>('/api/users/me/public-key', {
    method: 'POST',
    body: JSON.stringify({ publicKey }),
  });
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<{ ok: boolean }> {
  return apiRequest('/api/users/me/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}
