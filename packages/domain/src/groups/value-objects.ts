import { DomainError } from '../shared/domain-error.js';

const nonEmpty = (value: string, name: string): string => {
  if (!value.trim()) throw new DomainError(`${name} cannot be empty`, `${name.toLowerCase()}.empty`);
  return value;
};

export class GroupId {
  private constructor(readonly value: string) {}
  static create(value: string): GroupId { return new GroupId(nonEmpty(value, 'GroupId')); }
}

export class GroupInvitationId {
  private constructor(readonly value: string) {}
  static create(value: string): GroupInvitationId { return new GroupInvitationId(nonEmpty(value, 'GroupInvitationId')); }
}

export class GroupName {
  private constructor(readonly value: string) {}
  static create(value: string): GroupName {
    const normalized = nonEmpty(value, 'GroupName');
    if (normalized.length > 120) throw new DomainError('GroupName exceeds maximum length', 'group_name.too_large');
    return new GroupName(normalized);
  }
}

export class GroupKeyEpoch {
  private constructor(readonly value: number) {}
  static initial(): GroupKeyEpoch { return new GroupKeyEpoch(0); }
  static create(value: number): GroupKeyEpoch {
    if (!Number.isSafeInteger(value) || value < 0) throw new DomainError('GroupKeyEpoch must be a non-negative safe integer', 'group_key_epoch.invalid');
    return new GroupKeyEpoch(value);
  }
  next(): GroupKeyEpoch { return new GroupKeyEpoch(this.value + 1); }
}
