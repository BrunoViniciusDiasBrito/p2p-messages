import { Identity } from '@peercomms/domain';

export interface GeneratedIdentityMaterial {
  readonly peerId: string;
  readonly publicKey: string;
  readonly privateKeyReference: string;
  readonly fingerprint: string;
  readonly deviceId: string;
  readonly devicePublicKey: string;
}

export interface IdentityKeyProvider {
  generateIdentity(): Promise<GeneratedIdentityMaterial>;
}

export interface IdentityRepository {
  save(identity: Identity): Promise<void>;
  getLocal(): Promise<Identity | null>;
}
