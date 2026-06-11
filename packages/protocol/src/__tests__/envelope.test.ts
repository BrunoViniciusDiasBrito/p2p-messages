import { describe, expect, it } from 'vitest';
import { parseTransportEnvelope } from '../schemas/envelope.js';

describe('transport envelope schema', () => {
  it('validates versioned contact request envelopes', () => {
    const envelope = parseTransportEnvelope({
      protocolVersion: '1.0',
      envelopeId: 'env_1234567890',
      type: 'contact_request',
      fromPeerId: 'pc_abcdefghijklmnop',
      toPeerId: 'pc_qrstuvwxyzabcdef',
      createdAt: new Date().toISOString(),
      nonce: 'nonce_1234567890123456',
      payload: 'base64-payload',
      signature: 'sig_12345678901234567890123456789012'
    });
    expect(envelope.type).toBe('contact_request');
  });
});
