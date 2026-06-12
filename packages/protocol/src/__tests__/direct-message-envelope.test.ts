import { describe, expect, it } from 'vitest';
import { parseDirectMessageEnvelope } from '../schemas/direct-message-envelope.js';

describe('direct message envelope schema', () => {
  it('validates direct-message routing metadata and rejects group metadata', () => {
    const envelope = parseDirectMessageEnvelope({
      protocolVersion: '1.0',
      envelopeId: 'envelope_1234567890',
      type: 'direct_message',
      fromPeerId: 'pc_senderpeer123456',
      toPeerId: 'pc_targetpeer123456',
      conversationId: 'cnv_123',
      createdAt: new Date('2026-06-12T00:00:00.000Z').toISOString(),
      nonce: 'nonce_1234567890123456',
      payload: 'aes256gcm.payload',
      signature: 'ecdsa-p256-sha256.signature_payload_1234567890'
    });

    expect(envelope.type).toBe('direct_message');
    expect(() => parseDirectMessageEnvelope({ ...envelope, groupId: 'grp_forbidden' })).toThrow();
  });

  it('requires a recipient and conversation id for direct messages', () => {
    expect(() => parseDirectMessageEnvelope({
      protocolVersion: '1.0',
      envelopeId: 'envelope_1234567890',
      type: 'direct_message',
      fromPeerId: 'pc_senderpeer123456',
      createdAt: new Date('2026-06-12T00:00:00.000Z').toISOString(),
      nonce: 'nonce_1234567890123456',
      payload: 'aes256gcm.payload',
      signature: 'ecdsa-p256-sha256.signature_payload_1234567890'
    })).toThrow();
  });
});
