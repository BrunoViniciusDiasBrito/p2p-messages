import { describe, expect, it } from 'vitest';
import { InMemoryEncryptedVaultStorage, WebCryptoEncryptedJsonVault } from '../index.js';

describe('WebCryptoEncryptedJsonVault', () => {
  it('stores and restores JSON secrets using PBKDF2 and AES-GCM records', async () => {
    const storage = new InMemoryEncryptedVaultStorage();
    const vault = new WebCryptoEncryptedJsonVault(storage, { iterations: 1_000 });

    await vault.putJson('identity/private-key-reference', {
      privateKeyReference: 'webcrypto:p256:pc_examplepeer123456',
      exportedPrivateKey: 'redacted-test-fixture'
    }, 'correct horse battery staple', new Date('2026-06-12T00:00:00.000Z'));

    const raw = await storage.readRecord('identity/private-key-reference');
    expect(raw?.cipher).toBe('AES-256-GCM');
    expect(raw?.kdf).toBe('PBKDF2-SHA256');
    expect(raw?.ciphertext).not.toContain('redacted-test-fixture');

    const restored = await vault.getJson<{ privateKeyReference: string; exportedPrivateKey: string }>('identity/private-key-reference', 'correct horse battery staple');
    expect(restored).toEqual({ privateKeyReference: 'webcrypto:p256:pc_examplepeer123456', exportedPrivateKey: 'redacted-test-fixture' });
  });

  it('rejects wrong passphrases and returns null for missing records', async () => {
    const vault = new WebCryptoEncryptedJsonVault(new InMemoryEncryptedVaultStorage(), { iterations: 1_000 });
    expect(await vault.getJson('missing', 'passphrase')).toBeNull();

    await vault.putJson('shared-secret', { secret: 'test-secret' }, 'right-passphrase');
    await expect(vault.getJson('shared-secret', 'wrong-passphrase')).rejects.toThrow();
  });

  it('exports only encrypted records and rotates every persisted secret', async () => {
    const storage = new InMemoryEncryptedVaultStorage();
    const vault = new WebCryptoEncryptedJsonVault(storage, { iterations: 1_000 });
    await vault.putJson('identity', { privateKey: 'not-plaintext' }, 'first passphrase');
    await vault.putJson('secret', { value: 'shared' }, 'first passphrase');

    const backup = await vault.exportEncryptedBackup(new Date('2026-06-20T00:00:00.000Z'));
    expect(backup.records).toHaveLength(2);
    expect(JSON.stringify(backup)).not.toContain('not-plaintext');

    await vault.rotatePassphrase('first passphrase', 'next passphrase');
    await expect(vault.getJson('identity', 'first passphrase')).rejects.toThrow();
    expect(await vault.getJson('identity', 'next passphrase')).toEqual({ privateKey: 'not-plaintext' });
  });
});
