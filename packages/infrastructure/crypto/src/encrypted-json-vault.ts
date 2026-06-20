import { webcrypto } from 'node:crypto';

const cryptoImpl = globalThis.crypto ?? webcrypto;
const subtle = cryptoImpl.subtle;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const toBase64Url = (bytes: Uint8Array): string => Buffer.from(bytes)
  .toString('base64')
  .replaceAll('+', '-')
  .replaceAll('/', '_')
  .replaceAll('=', '');

const fromBase64Url = (value: string): Uint8Array => {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4);
  return new Uint8Array(Buffer.from(padded, 'base64'));
};

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

export interface EncryptedVaultRecord {
  readonly version: 1;
  readonly kdf: 'PBKDF2-SHA256';
  readonly iterations: number;
  readonly salt: string;
  readonly cipher: 'AES-256-GCM';
  readonly nonce: string;
  readonly ciphertext: string;
  readonly updatedAt: string;
}

export interface EncryptedVaultStoragePort {
  readRecord(key: string): Promise<EncryptedVaultRecord | null>;
  writeRecord(key: string, record: EncryptedVaultRecord): Promise<void>;
  deleteRecord(key: string): Promise<void>;
  listKeys(): Promise<readonly string[]>;
}

export class InMemoryEncryptedVaultStorage implements EncryptedVaultStoragePort {
  private readonly rows = new Map<string, EncryptedVaultRecord>();
  async readRecord(key: string): Promise<EncryptedVaultRecord | null> { return this.rows.get(key) ?? null; }
  async writeRecord(key: string, record: EncryptedVaultRecord): Promise<void> { this.rows.set(key, record); }
  async deleteRecord(key: string): Promise<void> { this.rows.delete(key); }
  async listKeys(): Promise<readonly string[]> { return [...this.rows.keys()].sort(); }
}

export interface EncryptedVaultBackup {
  readonly format: 'peercomms.encrypted-vault.v1';
  readonly exportedAt: string;
  readonly records: readonly { readonly key: string; readonly record: EncryptedVaultRecord }[];
}

export class WebCryptoEncryptedJsonVault {
  constructor(
    private readonly storage: EncryptedVaultStoragePort,
    private readonly options: { readonly iterations?: number } = {}
  ) {}

  async putJson<T>(key: string, value: T, passphrase: string, now = new Date()): Promise<void> {
    const salt = this.randomBytes(16);
    const nonce = this.randomBytes(12);
    const encryptionKey = await this.deriveKey(passphrase, salt, this.iterations);
    const plaintext = textEncoder.encode(JSON.stringify(value));
    const ciphertext = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv: toArrayBuffer(nonce) }, encryptionKey, plaintext));
    await this.storage.writeRecord(key, {
      version: 1,
      kdf: 'PBKDF2-SHA256',
      iterations: this.iterations,
      salt: toBase64Url(salt),
      cipher: 'AES-256-GCM',
      nonce: toBase64Url(nonce),
      ciphertext: toBase64Url(ciphertext),
      updatedAt: now.toISOString()
    });
  }

  async getJson<T>(key: string, passphrase: string): Promise<T | null> {
    const record = await this.storage.readRecord(key);
    if (!record) return null;
    if (record.version !== 1 || record.kdf !== 'PBKDF2-SHA256' || record.cipher !== 'AES-256-GCM') throw new Error('Unsupported encrypted vault record');
    const encryptionKey = await this.deriveKey(passphrase, fromBase64Url(record.salt), record.iterations);
    const plaintext = await subtle.decrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(fromBase64Url(record.nonce)) },
      encryptionKey,
      toArrayBuffer(fromBase64Url(record.ciphertext))
    );
    return JSON.parse(textDecoder.decode(plaintext)) as T;
  }

  async delete(key: string): Promise<void> {
    await this.storage.deleteRecord(key);
  }

  async exportEncryptedBackup(now = new Date()): Promise<EncryptedVaultBackup> {
    const records: Array<{ key: string; record: EncryptedVaultRecord }> = [];
    for (const key of await this.storage.listKeys()) {
      const record = await this.storage.readRecord(key);
      if (record) records.push({ key, record });
    }
    return { format: 'peercomms.encrypted-vault.v1', exportedAt: now.toISOString(), records };
  }

  async restoreEncryptedBackup(backup: EncryptedVaultBackup, options: { overwrite?: boolean } = {}): Promise<void> {
    if (backup.format !== 'peercomms.encrypted-vault.v1') throw new Error('Unsupported encrypted vault backup');
    for (const { key, record } of backup.records) {
      if (!options.overwrite && await this.storage.readRecord(key)) continue;
      await this.storage.writeRecord(key, record);
    }
  }

  async rotatePassphrase(currentPassphrase: string, nextPassphrase: string, now = new Date()): Promise<void> {
    if (!nextPassphrase) throw new Error('Vault passphrase cannot be empty');
    const values: Array<{ key: string; value: unknown }> = [];
    for (const key of await this.storage.listKeys()) {
      const value = await this.getJson<unknown>(key, currentPassphrase);
      if (value !== null) values.push({ key, value });
    }
    for (const { key, value } of values) await this.putJson(key, value, nextPassphrase, now);
  }

  private get iterations(): number {
    return this.options.iterations ?? 210_000;
  }

  private randomBytes(length: number): Uint8Array {
    const bytes = new Uint8Array(length);
    cryptoImpl.getRandomValues(bytes);
    return bytes;
  }

  private async deriveKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
    if (!passphrase) throw new Error('Vault passphrase cannot be empty');
    const keyMaterial = await subtle.importKey('raw', textEncoder.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
    return subtle.deriveKey(
      { name: 'PBKDF2', hash: 'SHA-256', salt: toArrayBuffer(salt), iterations },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }
}
