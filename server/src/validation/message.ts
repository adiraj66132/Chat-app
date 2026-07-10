import { z } from 'zod';

export const sendMessageSchema = z.object({
  content: z.string().min(1).max(5000).optional(),
  replyToId: z.string().uuid().optional(),
  type: z.enum(['TEXT', 'IMAGE', 'FILE']).optional(),
  iv: z.string().optional(),
  fileUrl: z.string().optional(),
  fileName: z.string().optional(),
  fileSize: z.number().optional(),
  mimeType: z.string().optional(),
}).refine((data) => data.content || data.fileUrl, {
  message: 'Message must have content or a file',
});

export const editMessageSchema = z.object({
  content: z.string().min(1).max(5000),
});
