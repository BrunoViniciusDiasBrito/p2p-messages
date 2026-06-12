import { AggregateRoot } from '../shared/domain-event.js';
import { DeviceId, PeerId } from '../shared/ids.js';
import { IdentityFingerprint, PrivateKeyReference, PublicKey } from './value-objects.js';

export interface DeviceProps {
  readonly id: DeviceId;
  readonly name: string;
  readonly publicKey: PublicKey;
  readonly createdAt: Date;
}

export class Device {
  constructor(readonly props: DeviceProps) {}
}

export interface IdentityProps {
  readonly peerId: PeerId;
  readonly publicKey: PublicKey;
  readonly privateKeyReference: PrivateKeyReference;
  readonly fingerprint: IdentityFingerprint;
  readonly devices: readonly Device[];
  readonly createdAt: Date;
}

export class Identity extends AggregateRoot {
  private constructor(readonly props: IdentityProps) { super(); }

  static createLocal(props: IdentityProps, eventId: string): Identity {
    const identity = new Identity(props);
    identity.record({
      id: eventId,
      name: 'IdentityCreated',
      occurredAt: props.createdAt,
      payload: { peerId: props.peerId.value, fingerprint: props.fingerprint.value }
    });
    return identity;
  }

  static rehydrate(props: IdentityProps): Identity { return new Identity(props); }

  publicProfile() {
    return {
      peerId: this.props.peerId.value,
      publicKey: this.props.publicKey.value,
      fingerprint: this.props.fingerprint.value,
      devices: this.props.devices.map((device) => ({ id: device.props.id.value, publicKey: device.props.publicKey.value }))
    };
  }
}
