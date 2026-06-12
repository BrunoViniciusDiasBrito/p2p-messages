import { z } from 'zod';

export const protocolVersionSchema = z.literal('1.0');

export const envelopeTypeSchema = z.enum([
  'contact_request',
  'contact_response',
  'direct_message',
  'group_invite',
  'group_message',
  'delivery_receipt',
  'key_rotation'
]);

const peerIdSchema = z.string().regex(/^pc_[a-zA-Z0-9_-]{16,}$/);
const optionalIdSchema = z.string().min(1).optional();
const isoDateSchema = z.string().datetime({ offset: true });

export const transportEnvelopeSchema = z.object({
  protocolVersion: protocolVersionSchema,
  envelopeId: z.string().min(12),
  type: envelopeTypeSchema,
  fromPeerId: peerIdSchema,
  toPeerId: peerIdSchema.optional(),
  conversationId: optionalIdSchema,
  groupId: optionalIdSchema,
  createdAt: isoDateSchema,
  expiresAt: isoDateSchema.optional(),
  nonce: z.string().min(16),
  payload: z.string().min(1),
  signature: z.string().min(32)
}).strict().refine((value) => value.type.includes('group') ? Boolean(value.groupId) : true, {
  message: 'group envelopes require groupId',
  path: ['groupId']
});

export type TransportEnvelope = z.infer<typeof transportEnvelopeSchema>;

export function parseTransportEnvelope(input: unknown): TransportEnvelope {
  return transportEnvelopeSchema.parse(input);
}
