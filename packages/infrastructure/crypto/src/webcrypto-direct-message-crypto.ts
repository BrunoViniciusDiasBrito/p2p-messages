import { webcrypto } from 'node:crypto';
import type { DirectMessageCryptoPort, GeneratedIdentityMaterial, IdentityKeyProvider } from '@peercomms/application';
import { WebCryptoEncryptedJsonVault } from './encrypted-json-vault.js';

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

const pairKey = (leftPeerId: string, rightPeerId: string): string => [leftPeerId, rightPeerId].sort().join('::');

export interface WebCryptoIdentityRecord {
  readonly peerId: string;
  readonly publicKey: string;
  readonly privateKeyReference: string;
  readonly fingerprint: string;
}

export interface WebCryptoKeyStore {
  createIdentity(): Promise<WebCryptoIdentityRecord>;
  registerPublicIdentity(input: { peerId: string; publicKey: string }): Promise<void>;
  registerSharedSecret(input: { leftPeerId: string; rightPeerId: string; secret: Uint8Array }): Promise<void>;
  getSigningKey(peerId: string): Promise<CryptoKey>;
  getVerificationKey(peerId: string): Promise<CryptoKey>;
  getSharedSecret(leftPeerId: string, rightPeerId: string): Promise<CryptoKey>;
}

interface PersistedIdentityKey {
  readonly version: 1;
  readonly algorithm: 'ECDSA-P-256';
  readonly peerId: string;
  readonly publicKey: string;
  readonly privateKeyReference: string;
  readonly fingerprint: string;
  readonly privateJwk: JsonWebKey;
}

interface PersistedSharedSecret {
  readonly version: 1;
  readonly algorithm: 'AES-256-GCM-SHA256';
  readonly leftPeerId: string;
  readonly rightPeerId: string;
  readonly secret: string;
}

interface PersistedPublicIdentity {
  readonly version: 1;
  readonly peerId: string;
  readonly publicKey: string;
}

const identityVaultKey = (peerId: string): string => `webcrypto.identity.${peerId}`;
const publicIdentityVaultKey = (peerId: string): string => `webcrypto.public-identity.${peerId}`;
const sharedSecretVaultKey = (leftPeerId: string, rightPeerId: string): string => `webcrypto.direct-secret.${pairKey(leftPeerId, rightPeerId)}`;

const importVerificationKey = async (publicKey: string): Promise<CryptoKey> => {
  if (!publicKey.startsWith('p256-spki.')) throw new Error('Unsupported public key format');
  return subtle.importKey(
    'spki',
    toArrayBuffer(fromBase64Url(publicKey.slice('p256-spki.'.length))),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify']
  );
};

const importSharedSecret = async (secret: Uint8Array): Promise<CryptoKey> => {
  if (secret.byteLength < 32) throw new Error('Direct-message shared secret must be at least 32 bytes');
  const digest = await subtle.digest('SHA-256', toArrayBuffer(secret));
  return subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
};

export class InMemoryWebCryptoKeyStore implements WebCryptoKeyStore {
  private readonly signingPrivateKeys = new Map<string, CryptoKey>();
  private readonly verificationPublicKeys = new Map<string, CryptoKey>();
  private readonly sharedSecrets = new Map<string, CryptoKey>();

  async createIdentity(): Promise<WebCryptoIdentityRecord> {
    const keyPair = await subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign', 'verify']
    ) as CryptoKeyPair;
    const spki = new Uint8Array(await subtle.exportKey('spki', keyPair.publicKey));
    const publicKey = `p256-spki.${toBase64Url(spki)}`;
    const digest = new Uint8Array(await subtle.digest('SHA-256', spki));
    const peerId = `pc_${toBase64Url(digest).slice(0, 32)}`;
    const fingerprint = `sha256:${toBase64Url(digest)}`;
    const privateKeyReference = `webcrypto:p256:${peerId}`;
    this.signingPrivateKeys.set(peerId, keyPair.privateKey);
    this.verificationPublicKeys.set(peerId, keyPair.publicKey);
    return { peerId, publicKey, privateKeyReference, fingerprint };
  }

  async registerPublicIdentity(input: { peerId: string; publicKey: string }): Promise<void> {
    const key = await importVerificationKey(input.publicKey);
    await this.vault.putJson<PersistedPublicIdentity>(publicIdentityVaultKey(input.peerId), {
      version: 1,
      peerId: input.peerId,
      publicKey: input.publicKey
    }, this.passphrase);
    this.verificationPublicKeys.set(input.peerId, key);
  }

  async registerSharedSecret(input: { leftPeerId: string; rightPeerId: string; secret: Uint8Array }): Promise<void> {
    this.sharedSecrets.set(pairKey(input.leftPeerId, input.rightPeerId), await importSharedSecret(input.secret));
  }

  async getSigningKey(peerId: string): Promise<CryptoKey> {
    const key = this.signingPrivateKeys.get(peerId);
    if (!key) throw new Error('Missing local signing key for peer');
    return key;
  }

  async getVerificationKey(peerId: string): Promise<CryptoKey> {
    const key = this.verificationPublicKeys.get(peerId);
    if (!key) throw new Error('Missing verification key for peer');
    return key;
  }

  async getSharedSecret(leftPeerId: string, rightPeerId: string): Promise<CryptoKey> {
    const key = this.sharedSecrets.get(pairKey(leftPeerId, rightPeerId));
    if (!key) throw new Error('Missing direct-message shared secret for peer pair');
    return key;
  }
}

export class PersistentWebCryptoKeyStore implements WebCryptoKeyStore {
  private readonly signingPrivateKeys = new Map<string, CryptoKey>();
  private readonly verificationPublicKeys = new Map<string, CryptoKey>();
  private readonly sharedSecrets = new Map<string, CryptoKey>();

  constructor(
    private readonly vault: WebCryptoEncryptedJsonVault,
    private passphrase: string
  ) {}

  lock(): void {
    this.signingPrivateKeys.clear();
    this.verificationPublicKeys.clear();
    this.sharedSecrets.clear();
  }

  async rotatePassphrase(nextPassphrase: string): Promise<void> {
    await this.vault.rotatePassphrase(this.passphrase, nextPassphrase);
    this.passphrase = nextPassphrase;
    this.lock();
  }

  async createIdentity(): Promise<WebCryptoIdentityRecord> {
    const keyPair = await subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify']
    ) as CryptoKeyPair;
    const spki = new Uint8Array(await subtle.exportKey('spki', keyPair.publicKey));
    const publicKey = `p256-spki.${toBase64Url(spki)}`;
    const digest = new Uint8Array(await subtle.digest('SHA-256', spki));
    const peerId = `pc_${toBase64Url(digest).slice(0, 32)}`;
    const fingerprint = `sha256:${toBase64Url(digest)}`;
    const privateKeyReference = `webcrypto-vault:p256:${peerId}`;
    const privateJwk = await subtle.exportKey('jwk', keyPair.privateKey);

    await this.vault.putJson<PersistedIdentityKey>(identityVaultKey(peerId), {
      version: 1,
      algorithm: 'ECDSA-P-256',
      peerId,
      publicKey,
      privateKeyReference,
      fingerprint,
      privateJwk
    }, this.passphrase);

    this.signingPrivateKeys.set(peerId, keyPair.privateKey);
    this.verificationPublicKeys.set(peerId, keyPair.publicKey);
    return { peerId, publicKey, privateKeyReference, fingerprint };
  }

  async registerPublicIdentity(input: { peerId: string; publicKey: string }): Promise<void> {
    this.verificationPublicKeys.set(input.peerId, await importVerificationKey(input.publicKey));
  }

  async registerSharedSecret(input: { leftPeerId: string; rightPeerId: string; secret: Uint8Array }): Promise<void> {
    const key = await importSharedSecret(input.secret);
    await this.vault.putJson<PersistedSharedSecret>(sharedSecretVaultKey(input.leftPeerId, input.rightPeerId), {
      version: 1,
      algorithm: 'AES-256-GCM-SHA256',
      leftPeerId: input.leftPeerId,
      rightPeerId: input.rightPeerId,
      secret: toBase64Url(input.secret)
    }, this.passphrase);
    this.sharedSecrets.set(pairKey(input.leftPeerId, input.rightPeerId), key);
  }

  async getSigningKey(peerId: string): Promise<CryptoKey> {
    const cached = this.signingPrivateKeys.get(peerId);
    if (cached) return cached;
    const persisted = await this.readPersistedIdentity(peerId);
    const privateKey = await subtle.importKey(
      'jwk',
      persisted.privateJwk,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign']
    );
    this.signingPrivateKeys.set(peerId, privateKey);
    return privateKey;
  }

  async getVerificationKey(peerId: string): Promise<CryptoKey> {
    const cached = this.verificationPublicKeys.get(peerId);
    if (cached) return cached;
    const local = await this.vault.getJson<PersistedIdentityKey>(identityVaultKey(peerId), this.passphrase);
    const remote = local ? null : await this.vault.getJson<PersistedPublicIdentity>(publicIdentityVaultKey(peerId), this.passphrase);
    const publicKeyValue = local?.publicKey ?? remote?.publicKey;
    if (!publicKeyValue || (remote && (remote.version !== 1 || remote.peerId !== peerId))) {
      throw new Error('Missing verification key for peer');
    }
    const publicKey = await importVerificationKey(publicKeyValue);
    this.verificationPublicKeys.set(peerId, publicKey);
    return publicKey;
  }

  async getSharedSecret(leftPeerId: string, rightPeerId: string): Promise<CryptoKey> {
    const cacheKey = pairKey(leftPeerId, rightPeerId);
    const cached = this.sharedSecrets.get(cacheKey);
    if (cached) return cached;
    const persisted = await this.vault.getJson<PersistedSharedSecret>(sharedSecretVaultKey(leftPeerId, rightPeerId), this.passphrase);
    if (!persisted || persisted.version !== 1 || persisted.algorithm !== 'AES-256-GCM-SHA256') {
      throw new Error('Missing direct-message shared secret for peer pair');
    }
    const key = await importSharedSecret(fromBase64Url(persisted.secret));
    this.sharedSecrets.set(cacheKey, key);
    return key;
  }

  private async readPersistedIdentity(peerId: string): Promise<PersistedIdentityKey> {
    const persisted = await this.vault.getJson<PersistedIdentityKey>(identityVaultKey(peerId), this.passphrase);
    if (!persisted || persisted.version !== 1 || persisted.algorithm !== 'ECDSA-P-256' || persisted.peerId !== peerId) {
      throw new Error('Missing local signing key for peer');
    }
    return persisted;
  }
}

export class WebCryptoIdentityKeyProvider implements IdentityKeyProvider {
  constructor(private readonly keys: WebCryptoKeyStore) {}

  async generateIdentity(): Promise<GeneratedIdentityMaterial> {
    const identity = await this.keys.createIdentity();
    return {
      ...identity,
      deviceId: `dev_${identity.peerId.slice(3, 19)}`,
      devicePublicKey: identity.publicKey
    };
  }
}

export class WebCryptoDirectMessageCrypto implements DirectMessageCryptoPort {
  constructor(private readonly keys: WebCryptoKeyStore) {}

  async encryptDirect(input: { plaintext: string; fromPeerId: string; toPeerId: string }): Promise<{ encryptedPayload: string; nonce: string }> {
    const nonce = new Uint8Array(12);
    cryptoImpl.getRandomValues(nonce);
    const key = await this.keys.getSharedSecret(input.fromPeerId, input.toPeerId);
    const ciphertext = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv: toArrayBuffer(nonce) }, key, textEncoder.encode(input.plaintext)));
    return { encryptedPayload: `aes256gcm.${toBase64Url(ciphertext)}`, nonce: toBase64Url(nonce) };
  }

  async decryptDirect(input: { encryptedPayload: string; fromPeerId: string; toPeerId: string; nonce?: string }): Promise<string> {
    if (!input.encryptedPayload.startsWith('aes256gcm.')) throw new Error('Unsupported direct-message payload format');
    if (!input.nonce) throw new Error('AES-GCM direct-message decryption requires nonce');
    const key = await this.keys.getSharedSecret(input.fromPeerId, input.toPeerId);
    const plaintext = await subtle.decrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(fromBase64Url(input.nonce)) },
      key,
      toArrayBuffer(fromBase64Url(input.encryptedPayload.slice('aes256gcm.'.length)))
    );
    return textDecoder.decode(plaintext);
  }

  async signEnvelope(input: { canonicalEnvelope: string; fromPeerId: string }): Promise<string> {
    const signature = new Uint8Array(await subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      await this.keys.getSigningKey(input.fromPeerId),
      textEncoder.encode(input.canonicalEnvelope)
    ));
    return `ecdsa-p256-sha256.${toBase64Url(signature)}`;
  }

  async verifyEnvelopeSignature(input: { canonicalEnvelope: string; signature: string; fromPeerId: string }): Promise<boolean> {
    if (!input.signature.startsWith('ecdsa-p256-sha256.')) return false;
    return subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      await this.keys.getVerificationKey(input.fromPeerId),
      toArrayBuffer(fromBase64Url(input.signature.slice('ecdsa-p256-sha256.'.length))),
      textEncoder.encode(input.canonicalEnvelope)
    );
  }
}
