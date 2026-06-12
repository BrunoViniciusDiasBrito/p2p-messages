import { describe, expect, it } from 'vitest';
import { InMemoryWebCryptoKeyStore, WebCryptoDirectMessageCrypto, WebCryptoIdentityKeyProvider } from '../index.js';

describe('WebCryptoDirectMessageCrypto', () => {
  it('generates public-key identities, signs envelopes, and encrypts direct messages with AES-GCM', async () => {
    const keys = new InMemoryWebCryptoKeyStore();
    const provider = new WebCryptoIdentityKeyProvider(keys);
    const alice = await provider.generateIdentity();
    const bob = await provider.generateIdentity();
    await keys.registerSharedSecret({ leftPeerId: alice.peerId, rightPeerId: bob.peerId, secret: new Uint8Array(32).fill(7) });

    const crypto = new WebCryptoDirectMessageCrypto(keys);
    const encrypted = await crypto.encryptDirect({ plaintext: 'Olá com WebCrypto', fromPeerId: alice.peerId, toPeerId: bob.peerId });
    expect(encrypted.encryptedPayload.startsWith('aes256gcm.')).toBe(true);
    expect(encrypted.nonce.length).toBeGreaterThan(15);

    const plaintext = await crypto.decryptDirect({ encryptedPayload: encrypted.encryptedPayload, nonce: encrypted.nonce, fromPeerId: alice.peerId, toPeerId: bob.peerId });
    expect(plaintext).toBe('Olá com WebCrypto');

    const canonicalEnvelope = JSON.stringify({ protocolVersion: '1.0', fromPeerId: alice.peerId, toPeerId: bob.peerId, payload: encrypted.encryptedPayload, nonce: encrypted.nonce });
    const signature = await crypto.signEnvelope({ canonicalEnvelope, fromPeerId: alice.peerId });
    await keys.registerPublicIdentity({ peerId: alice.peerId, publicKey: alice.publicKey });
    expect(await crypto.verifyEnvelopeSignature({ canonicalEnvelope, signature, fromPeerId: alice.peerId })).toBe(true);
    expect(await crypto.verifyEnvelopeSignature({ canonicalEnvelope: `${canonicalEnvelope}.tampered`, signature, fromPeerId: alice.peerId })).toBe(false);
  });
});
