import { apiRequest } from './client';
import type { AuthResponse, LoginInput, RegisterInput, RefreshResponse } from '../types/auth';

export async function login(data: LoginInput): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function register(data: RegisterInput): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function logout(): Promise<void> {
  await apiRequest('/api/auth/logout', { method: 'POST' });
}

export async function refreshToken(): Promise<RefreshResponse> {
  return apiRequest<RefreshResponse>('/api/auth/refresh', {
    method: 'POST',
  });
}
