export interface CryptoPort {
  generateIdentityMaterial(): Promise<{
    peerId: string;
    publicKey: string;
    privateKeyReference: string;
    fingerprint: string;
  }>;
  sign(input: Uint8Array, privateKeyReference: string): Promise<string>;
  verify(input: Uint8Array, signature: string, publicKey: string): Promise<boolean>;
}

export const cryptoAdapterNotice = 'Use audited open-source primitives such as libsodium/noble/OpenMLS adapters; no custom cryptography is implemented in domain code.';

export * from './webcrypto-direct-message-crypto.js';
