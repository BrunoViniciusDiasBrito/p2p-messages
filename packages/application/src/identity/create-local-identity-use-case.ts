import { Device, DeviceId, Identity, IdentityFingerprint, PeerId, PrivateKeyReference, PublicKey, Result, err, ok } from '@peercomms/domain';
import { DomainEventBus } from '../ports/event-bus.js';
import { IdentityKeyProvider, IdentityRepository } from '../ports/identity-ports.js';
import { IdGenerator } from '../ports/id-generator.js';

export class CreateLocalIdentityUseCase {
  constructor(
    private readonly keys: IdentityKeyProvider,
    private readonly identities: IdentityRepository,
    private readonly events: DomainEventBus,
    private readonly ids: IdGenerator
  ) {}

  async execute(input: { deviceName: string }): Promise<Result<{ peerId: string; fingerprint: string }>> {
    const existing = await this.identities.getLocal();
    if (existing) return err(new Error('Local identity already exists'));
    const material = await this.keys.generateIdentity();
    const now = new Date();
    const device = new Device({ id: DeviceId.create(material.deviceId), name: input.deviceName, publicKey: PublicKey.create(material.devicePublicKey), createdAt: now });
    const identity = Identity.createLocal({
      peerId: PeerId.create(material.peerId),
      publicKey: PublicKey.create(material.publicKey),
      privateKeyReference: PrivateKeyReference.create(material.privateKeyReference),
      fingerprint: IdentityFingerprint.create(material.fingerprint),
      devices: [device],
      createdAt: now
    }, this.ids.newId('evt'));
    await this.identities.save(identity);
    await this.events.publish(identity.pullDomainEvents());
    return ok({ peerId: identity.props.peerId.value, fingerprint: identity.props.fingerprint.value });
  }
}
