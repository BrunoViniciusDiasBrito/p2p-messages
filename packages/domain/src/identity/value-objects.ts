import { DomainError } from '../shared/domain-error.js';

export class PublicKey {
  private constructor(readonly value: string) {}
  static create(value: string): PublicKey {
    if (!value.startsWith('pub_')) throw new DomainError('PublicKey must be encoded and prefixed with pub_', 'public_key.invalid');
    return new PublicKey(value);
  }
}

export class PrivateKeyReference {
  private constructor(readonly value: string) {}
  static create(value: string): PrivateKeyReference {
    if (!value.startsWith('keyref_')) throw new DomainError('Private key material must be referenced, not embedded', 'private_key_ref.invalid');
    return new PrivateKeyReference(value);
  }
}

export class IdentityFingerprint {
  private constructor(readonly value: string) {}
  static create(value: string): IdentityFingerprint {
    if (!/^fp_[a-f0-9]{32,}$/i.test(value)) throw new DomainError('Invalid identity fingerprint', 'fingerprint.invalid');
    return new IdentityFingerprint(value);
  }
}

export interface RecoveryBundle {
  readonly encryptedBundle: string;
  readonly createdAt: Date;
  readonly kdf: 'argon2id';
}
