import { z } from 'zod';

export const groupInvitePayloadSchema = z.object({
  invitationId: z.string().min(1),
  groupId: z.string().min(1),
  groupName: z.string().min(1).max(120),
  inviterPeerId: z.string().regex(/^pc_[a-zA-Z0-9_-]{16,}$/),
  inviteePeerId: z.string().regex(/^pc_[a-zA-Z0-9_-]{16,}$/),
  keyEpoch: z.number().int().nonnegative(),
  welcomePayload: z.string().min(16)
}).strict();

export const groupMessagePayloadSchema = z.object({
  messageId: z.string().min(1),
  groupId: z.string().min(1),
  keyEpoch: z.number().int().nonnegative(),
  ciphertext: z.string().min(16)
}).strict();

export const keyRotationPayloadSchema = z.object({
  groupId: z.string().min(1),
  previousEpoch: z.number().int().nonnegative(),
  nextEpoch: z.number().int().nonnegative(),
  reason: z.enum(['member_added', 'member_removed', 'manual'])
}).strict().refine((value) => value.nextEpoch > value.previousEpoch, {
  message: 'nextEpoch must be greater than previousEpoch',
  path: ['nextEpoch']
});

export type GroupInvitePayload = z.infer<typeof groupInvitePayloadSchema>;
export type GroupMessagePayload = z.infer<typeof groupMessagePayloadSchema>;
export type KeyRotationPayload = z.infer<typeof keyRotationPayloadSchema>;
