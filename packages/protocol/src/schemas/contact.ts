import { z } from 'zod';

export const contactRequestPayloadSchema = z.object({
  requestId: z.string().min(1),
  publicProfile: z.object({
    peerId: z.string(),
    publicKey: z.string(),
    fingerprint: z.string()
  }),
  message: z.string().max(500).optional()
}).strict();

export const contactResponsePayloadSchema = z.object({
  requestId: z.string().min(1),
  accepted: z.boolean(),
  reason: z.string().max(500).optional()
}).strict();
