import { DomainError } from '../shared/domain-error.js';

const requireNonEmpty = (value: string, name: string): string => {
  if (!value.trim()) throw new DomainError(`${name} cannot be empty`, `${name.toLowerCase()}.empty`);
  return value;
};

export class MessageId {
  private constructor(readonly value: string) {}
  static create(value: string): MessageId { return new MessageId(requireNonEmpty(value, 'MessageId')); }
}

export class ConversationId {
  private constructor(readonly value: string) {}
  static create(value: string): ConversationId { return new ConversationId(requireNonEmpty(value, 'ConversationId')); }
}

export class MessageBody {
  private constructor(readonly value: string) {}
  static create(value: string): MessageBody {
    const normalized = requireNonEmpty(value, 'MessageBody');
    if (normalized.length > 10000) throw new DomainError('MessageBody exceeds maximum length', 'message_body.too_large');
    return new MessageBody(normalized);
  }
}

export class EncryptedPayload {
  private constructor(readonly value: string) {}
  static create(value: string): EncryptedPayload {
    if (value.length < 16) throw new DomainError('EncryptedPayload must be encoded ciphertext', 'encrypted_payload.invalid');
    return new EncryptedPayload(value);
  }
}

export class Signature {
  private constructor(readonly value: string) {}
  static create(value: string): Signature {
    if (value.length < 16) throw new DomainError('Signature must be encoded and non-trivial', 'signature.invalid');
    return new Signature(value);
  }
}

export class LamportClock {
  private constructor(readonly value: number) {}
  static initial(): LamportClock { return new LamportClock(0); }
  static create(value: number): LamportClock {
    if (!Number.isSafeInteger(value) || value < 0) throw new DomainError('LamportClock must be a non-negative safe integer', 'lamport_clock.invalid');
    return new LamportClock(value);
  }
  tick(): LamportClock { return new LamportClock(this.value + 1); }
  merge(remote: LamportClock): LamportClock { return new LamportClock(Math.max(this.value, remote.value) + 1); }
}
