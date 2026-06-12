import type { EncryptedVaultRecord, EncryptedVaultStoragePort } from '@peercomms/crypto';
import type { SqliteDatabasePort, SqliteRow } from './database.js';

interface VaultRecordRow extends SqliteRow {
  key: string;
  version: number;
  kdf: string;
  iterations: number;
  salt: string;
  cipher: string;
  nonce: string;
  ciphertext: string;
  updated_at: string;
}

const toRecord = (row: VaultRecordRow): EncryptedVaultRecord => ({
  version: 1,
  kdf: row.kdf as 'PBKDF2-SHA256',
  iterations: row.iterations,
  salt: row.salt,
  cipher: row.cipher as 'AES-256-GCM',
  nonce: row.nonce,
  ciphertext: row.ciphertext,
  updatedAt: row.updated_at
});

export class SqliteEncryptedVaultStorage implements EncryptedVaultStoragePort {
  constructor(private readonly db: SqliteDatabasePort) {}

  async readRecord(key: string): Promise<EncryptedVaultRecord | null> {
    const row = await this.db.queryOne<VaultRecordRow>(
      'SELECT key, version, kdf, iterations, salt, cipher, nonce, ciphertext, updated_at FROM encrypted_vault_records WHERE key = ?',
      [key]
    );
    return row ? toRecord(row) : null;
  }

  async writeRecord(key: string, record: EncryptedVaultRecord): Promise<void> {
    await this.db.execute(
      `INSERT INTO encrypted_vault_records (key, version, kdf, iterations, salt, cipher, nonce, ciphertext, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         version = excluded.version,
         kdf = excluded.kdf,
         iterations = excluded.iterations,
         salt = excluded.salt,
         cipher = excluded.cipher,
         nonce = excluded.nonce,
         ciphertext = excluded.ciphertext,
         updated_at = excluded.updated_at`,
      [key, record.version, record.kdf, record.iterations, record.salt, record.cipher, record.nonce, record.ciphertext, record.updatedAt]
    );
  }

  async deleteRecord(key: string): Promise<void> {
    await this.db.execute('DELETE FROM encrypted_vault_records WHERE key = ?', [key]);
  }
}
