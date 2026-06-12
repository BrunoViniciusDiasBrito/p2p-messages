import { z } from 'zod';

export const directMessagePayloadSchema = z.object({
  messageId: z.string().min(1),
  conversationId: z.string().min(1),
  lamportClock: z.number().int().nonnegative(),
  contentType: z.literal('text/plain'),
  ciphertext: z.string().min(16)
}).strict();

export type DirectMessagePayload = z.infer<typeof directMessagePayloadSchema>;
