import { DomainError } from './domain-error.js';

const nonEmpty = (value: string, name: string): string => {
  if (!value.trim()) throw new DomainError(`${name} cannot be empty`, 'value.empty');
  return value;
};

export class PeerId {
  private constructor(readonly value: string) {}
  static create(value: string): PeerId {
    const normalized = nonEmpty(value, 'PeerId');
    if (!/^pc_[a-zA-Z0-9_-]{16,}$/.test(normalized)) {
      throw new DomainError('PeerId must be a public key derived id prefixed with pc_', 'peer_id.invalid');
    }
    return new PeerId(normalized);
  }
}

export class DeviceId {
  private constructor(readonly value: string) {}
  static create(value: string): DeviceId { return new DeviceId(nonEmpty(value, 'DeviceId')); }
}

export class ContactRequestId {
  private constructor(readonly value: string) {}
  static create(value: string): ContactRequestId { return new ContactRequestId(nonEmpty(value, 'ContactRequestId')); }
}
