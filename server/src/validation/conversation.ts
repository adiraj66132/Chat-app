import { z } from 'zod';

export const createConversationSchema = z.object({
  participantId: z.string().uuid(),
});

const MAX_GROUP_MEMBERS = 250;

export const createGroupSchema = z
  .object({
    name: z.string().trim().min(1, 'Group name is required').max(100),
    description: z.string().max(1000).optional(),
    avatarUrl: z.string().max(500).optional(),
    participantIds: z
      .array(z.string().uuid())
      .min(1, 'Invite at least one member')
      .max(MAX_GROUP_MEMBERS),
  })
  .refine((d) => new Set(d.participantIds).size === d.participantIds.length, {
    message: 'Duplicate participants',
    path: ['participantIds'],
  });

export const addMembersSchema = z
  .object({
    userIds: z
      .array(z.string().uuid())
      .min(1, 'Select at least one member')
      .max(MAX_GROUP_MEMBERS),
  })
  .refine((d) => new Set(d.userIds).size === d.userIds.length, {
    message: 'Duplicate members',
    path: ['userIds'],
  });

export const updateGroupSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().max(1000).nullable().optional(),
  avatarUrl: z.string().max(500).nullable().optional(),
});

export const changeRoleSchema = z.object({
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER']),
});
