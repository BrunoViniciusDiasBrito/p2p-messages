import { describe, expect, it } from 'vitest';
import type { SqliteDatabasePort, SqliteParams, SqliteRow } from '../database.js';
import { SqliteEncryptedVaultStorage } from '../index.js';

class FakeVaultDb implements SqliteDatabasePort {
  readonly rows = new Map<string, Record<string, string | number>>();
  readonly executed: Array<{ sql: string; params: SqliteParams }> = [];

  async execute(sql: string, params: SqliteParams = []): Promise<void> {
    this.executed.push({ sql, params });
    if (sql.startsWith('INSERT INTO encrypted_vault_records')) {
      const [key, version, kdf, iterations, salt, cipher, nonce, ciphertext, updatedAt] = params;
      this.rows.set(String(key), {
        key: String(key),
        version: Number(version),
        kdf: String(kdf),
        iterations: Number(iterations),
        salt: String(salt),
        cipher: String(cipher),
        nonce: String(nonce),
        ciphertext: String(ciphertext),
        updated_at: String(updatedAt)
      });
    }
    if (sql.startsWith('DELETE FROM encrypted_vault_records')) this.rows.delete(String(params[0]));
  }

  async query<T extends SqliteRow = SqliteRow>(): Promise<T[]> { return []; }
  async queryOne<T extends SqliteRow = SqliteRow>(_sql: string, params: SqliteParams = []): Promise<T | null> {
    return (this.rows.get(String(params[0])) as T | undefined) ?? null;
  }
}

describe('SqliteEncryptedVaultStorage', () => {
  it('upserts, reads, and deletes encrypted vault records without plaintext columns', async () => {
    const db = new FakeVaultDb();
    const storage = new SqliteEncryptedVaultStorage(db);

    await storage.writeRecord('identity/private', {
      version: 1,
      kdf: 'PBKDF2-SHA256',
      iterations: 210000,
      salt: 'salt_b64url',
      cipher: 'AES-256-GCM',
      nonce: 'nonce_b64url',
      ciphertext: 'ciphertext_b64url',
      updatedAt: '2026-06-12T00:00:00.000Z'
    });

    expect(await storage.readRecord('identity/private')).toEqual({
      version: 1,
      kdf: 'PBKDF2-SHA256',
      iterations: 210000,
      salt: 'salt_b64url',
      cipher: 'AES-256-GCM',
      nonce: 'nonce_b64url',
      ciphertext: 'ciphertext_b64url',
      updatedAt: '2026-06-12T00:00:00.000Z'
    });
    expect(db.executed[0]?.sql).not.toContain('plaintext');

    await storage.deleteRecord('identity/private');
    expect(await storage.readRecord('identity/private')).toBeNull();
  });
});
