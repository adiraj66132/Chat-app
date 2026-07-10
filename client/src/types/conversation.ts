import type { User } from './auth';

export interface Conversation {
  id: string;
  type: 'DM' | 'GROUP' | 'GLOBAL';
  name?: string;
  avatarUrl?: string;
  lastMessage?: Message;
  unreadCount: number;
  participants: User[];
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId?: string;
  content?: string;
  type: 'TEXT' | 'IMAGE' | 'FILE';
  status?: 'SENT' | 'DELIVERED' | 'READ';
  deliveredAt?: string;
  readAt?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  iv?: string;
  replyToId?: string;
  editedAt?: string;
  deletedAt?: string;
  createdAt: string;
  sender?: User;
  replyTo?: {
    id: string;
    content?: string;
    sender: { id: string; displayName: string };
  };
  reactions?: MessageReaction[];
}

export interface MessageReaction {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  user: { id: string; username: string };
}

export interface MessagesResponse {
  messages: Message[];
  nextCursor: string | null;
}

export interface SendMessageInput {
  content?: string;
  replyToId?: string;
  type?: 'TEXT' | 'IMAGE' | 'FILE';
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
}
