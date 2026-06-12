import { webcrypto } from 'node:crypto';
import type { DirectMessageCryptoPort, GeneratedIdentityMaterial, IdentityKeyProvider } from '@peercomms/application';

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

export class InMemoryWebCryptoKeyStore {
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
    if (!input.publicKey.startsWith('p256-spki.')) throw new Error('Unsupported public key format');
    const publicKey = await subtle.importKey(
      'spki',
      toArrayBuffer(fromBase64Url(input.publicKey.slice('p256-spki.'.length))),
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify']
    );
    this.verificationPublicKeys.set(input.peerId, publicKey);
  }

  async registerSharedSecret(input: { leftPeerId: string; rightPeerId: string; secret: Uint8Array }): Promise<void> {
    if (input.secret.byteLength < 32) throw new Error('Direct-message shared secret must be at least 32 bytes');
    const digest = await subtle.digest('SHA-256', toArrayBuffer(input.secret));
    const key = await subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
    this.sharedSecrets.set(pairKey(input.leftPeerId, input.rightPeerId), key);
  }

  getSigningKey(peerId: string): CryptoKey {
    const key = this.signingPrivateKeys.get(peerId);
    if (!key) throw new Error('Missing local signing key for peer');
    return key;
  }

  getVerificationKey(peerId: string): CryptoKey {
    const key = this.verificationPublicKeys.get(peerId);
    if (!key) throw new Error('Missing verification key for peer');
    return key;
  }

  getSharedSecret(leftPeerId: string, rightPeerId: string): CryptoKey {
    const key = this.sharedSecrets.get(pairKey(leftPeerId, rightPeerId));
    if (!key) throw new Error('Missing direct-message shared secret for peer pair');
    return key;
  }
}

export class WebCryptoIdentityKeyProvider implements IdentityKeyProvider {
  constructor(private readonly keys: InMemoryWebCryptoKeyStore) {}

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
  constructor(private readonly keys: InMemoryWebCryptoKeyStore) {}

  async encryptDirect(input: { plaintext: string; fromPeerId: string; toPeerId: string }): Promise<{ encryptedPayload: string; nonce: string }> {
    const nonce = new Uint8Array(12);
    cryptoImpl.getRandomValues(nonce);
    const key = this.keys.getSharedSecret(input.fromPeerId, input.toPeerId);
    const ciphertext = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv: toArrayBuffer(nonce) }, key, textEncoder.encode(input.plaintext)));
    return { encryptedPayload: `aes256gcm.${toBase64Url(ciphertext)}`, nonce: toBase64Url(nonce) };
  }

  async decryptDirect(input: { encryptedPayload: string; fromPeerId: string; toPeerId: string; nonce?: string }): Promise<string> {
    if (!input.encryptedPayload.startsWith('aes256gcm.')) throw new Error('Unsupported direct-message payload format');
    if (!input.nonce) throw new Error('AES-GCM direct-message decryption requires nonce');
    const key = this.keys.getSharedSecret(input.fromPeerId, input.toPeerId);
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
      this.keys.getSigningKey(input.fromPeerId),
      textEncoder.encode(input.canonicalEnvelope)
    ));
    return `ecdsa-p256-sha256.${toBase64Url(signature)}`;
  }

  async verifyEnvelopeSignature(input: { canonicalEnvelope: string; signature: string; fromPeerId: string }): Promise<boolean> {
    if (!input.signature.startsWith('ecdsa-p256-sha256.')) return false;
    return subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      this.keys.getVerificationKey(input.fromPeerId),
      toArrayBuffer(fromBase64Url(input.signature.slice('ecdsa-p256-sha256.'.length))),
      textEncoder.encode(input.canonicalEnvelope)
    );
  }
}
