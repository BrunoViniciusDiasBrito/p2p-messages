import { describe, expect, it } from 'vitest';
import {
  InMemoryEncryptedVaultStorage,
  InMemoryWebCryptoKeyStore,
  PersistentWebCryptoKeyStore,
  WebCryptoDirectMessageCrypto,
  WebCryptoEncryptedJsonVault,
  WebCryptoIdentityKeyProvider
} from '../index.js';

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

  it('persists private signing keys and direct-message shared secrets in the encrypted vault', async () => {
    const storage = new InMemoryEncryptedVaultStorage();
    const vault = new WebCryptoEncryptedJsonVault(storage, { iterations: 1_000 });
    const firstRunKeys = new PersistentWebCryptoKeyStore(vault, 'local passphrase');
    const provider = new WebCryptoIdentityKeyProvider(firstRunKeys);
    const alice = await provider.generateIdentity();
    const bob = await provider.generateIdentity();
    await firstRunKeys.registerSharedSecret({ leftPeerId: alice.peerId, rightPeerId: bob.peerId, secret: new Uint8Array(32).fill(13) });

    const firstRunCrypto = new WebCryptoDirectMessageCrypto(firstRunKeys);
    const encrypted = await firstRunCrypto.encryptDirect({ plaintext: 'persisted secret', fromPeerId: alice.peerId, toPeerId: bob.peerId });
    const canonicalEnvelope = JSON.stringify({ protocolVersion: '1.0', fromPeerId: alice.peerId, toPeerId: bob.peerId, payload: encrypted.encryptedPayload, nonce: encrypted.nonce });
    const signature = await firstRunCrypto.signEnvelope({ canonicalEnvelope, fromPeerId: alice.peerId });

    const secondRunKeys = new PersistentWebCryptoKeyStore(vault, 'local passphrase');
    const secondRunCrypto = new WebCryptoDirectMessageCrypto(secondRunKeys);
    await firstRunKeys.registerPublicIdentity({ peerId: bob.peerId, publicKey: bob.publicKey });

    await expect(secondRunCrypto.decryptDirect({ encryptedPayload: encrypted.encryptedPayload, nonce: encrypted.nonce, fromPeerId: alice.peerId, toPeerId: bob.peerId }))
      .resolves.toBe('persisted secret');
    await expect(secondRunCrypto.verifyEnvelopeSignature({ canonicalEnvelope, signature, fromPeerId: alice.peerId }))
      .resolves.toBe(true);
    expect(alice.privateKeyReference).toBe(`webcrypto-vault:p256:${alice.peerId}`);
    await expect(secondRunKeys.getVerificationKey(bob.peerId)).resolves.toBeDefined();
  });

  it('locks cached keys and keeps access after a passphrase rotation', async () => {
    const vault = new WebCryptoEncryptedJsonVault(new InMemoryEncryptedVaultStorage(), { iterations: 1_000 });
    const keys = new PersistentWebCryptoKeyStore(vault, 'first passphrase');
    const identity = await new WebCryptoIdentityKeyProvider(keys).generateIdentity();
    const canonicalEnvelope = JSON.stringify({ hello: 'vault rotation' });
    const signature = await new WebCryptoDirectMessageCrypto(keys).signEnvelope({ canonicalEnvelope, fromPeerId: identity.peerId });

    keys.lock();
    await keys.rotatePassphrase('next passphrase');
    expect(await new WebCryptoDirectMessageCrypto(keys).verifyEnvelopeSignature({ canonicalEnvelope, signature, fromPeerId: identity.peerId })).toBe(true);
  });
});
