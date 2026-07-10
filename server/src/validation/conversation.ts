import { z } from 'zod';

export const createConversationSchema = z.object({
  participantId: z.string().uuid(),
});

export const putKeysSchema = z.object({
  keys: z
    .array(
      z.object({
        userId: z.string().uuid(),
        wrappedKey: z.string().min(1),
      })
    )
    .min(1),
});
