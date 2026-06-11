import { describe, expect, it } from 'vitest';
import { Device, DeviceId, Identity, IdentityFingerprint, PeerId, PrivateKeyReference, PublicKey } from '../index.js';

describe('Identity', () => {
  it('exposes public profile without private key references', () => {
    const now = new Date();
    const identity = Identity.createLocal({
      peerId: PeerId.create('pc_abcdefghijklmnop'),
      publicKey: PublicKey.create('pub_identity'),
      privateKeyReference: PrivateKeyReference.create('keyref_os_keystore_identity'),
      fingerprint: IdentityFingerprint.create('fp_0123456789abcdef0123456789abcdef'),
      devices: [new Device({ id: DeviceId.create('device_1'), name: 'Laptop', publicKey: PublicKey.create('pub_device'), createdAt: now })],
      createdAt: now
    }, 'evt_1');

    expect(identity.publicProfile()).not.toHaveProperty('privateKeyReference');
    expect(identity.pullDomainEvents()[0]?.name).toBe('IdentityCreated');
  });
});
