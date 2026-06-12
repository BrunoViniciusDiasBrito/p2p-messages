import { z } from 'zod';
import { protocolVersionSchema } from './envelope.js';

const peerIdSchema = z.string().regex(/^pc_[a-zA-Z0-9_-]{16,}$/);
const isoDateSchema = z.string().datetime({ offset: true });

export const directMessageEnvelopeSchema = z.object({
  protocolVersion: protocolVersionSchema,
  envelopeId: z.string().min(12),
  type: z.literal('direct_message'),
  fromPeerId: peerIdSchema,
  toPeerId: peerIdSchema,
  conversationId: z.string().min(1),
  groupId: z.undefined().optional(),
  createdAt: isoDateSchema,
  expiresAt: isoDateSchema.optional(),
  nonce: z.string().min(16),
  payload: z.string().min(1),
  signature: z.string().min(32)
}).strict();

export type DirectMessageEnvelope = z.infer<typeof directMessageEnvelopeSchema>;

export function parseDirectMessageEnvelope(input: unknown): DirectMessageEnvelope {
  return directMessageEnvelopeSchema.parse(input);
}
