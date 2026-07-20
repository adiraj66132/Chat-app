import { prisma } from '../config/db';

// Per-participant wrapped Conversation Encryption Key (CEK) storage. The server
// only ever persists ciphertext it cannot decrypt; each participant's CEK is
// wrapped (encrypted) client-side with that participant's public key.

export async function upsertConversationKey(
  conversationId: string,
  userId: string,
  wrappedKey: string
) {
  return prisma.conversationKey.upsert({
    where: { conversationId_userId: { conversationId, userId } },
    create: { conversationId, userId, wrappedKey },
    update: { wrappedKey },
  });
}

export async function getConversationKey(conversationId: string, userId: string) {
  return prisma.conversationKey.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
}

// Returns the wrapped keys for every participant of a conversation. Used by
// clients to discover which peers have already published a key for the room.
export async function listConversationKeys(conversationId: string) {
  return prisma.conversationKey.findMany({
    where: { conversationId },
    select: { userId: true, wrappedKey: true },
  });
}
