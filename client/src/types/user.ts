export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  publicKey?: string | null;
  theme?: 'LIGHT' | 'DARK' | 'TELEGRAM' | 'NORD';
  lastSeenAt?: string;
  createdAt?: string;
}

export interface UpdateProfileInput {
  displayName?: string;
  username?: string;
  bio?: string;
}
