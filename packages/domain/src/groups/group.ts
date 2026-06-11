import { AggregateRoot } from '../shared/domain-event.js';
import { DomainError } from '../shared/domain-error.js';
import { PeerId } from '../shared/ids.js';
import { GroupId, GroupKeyEpoch, GroupName } from './value-objects.js';

export type GroupMemberRole = 'owner' | 'admin' | 'member';
export type GroupMemberStatus = 'active' | 'removed';

export interface GroupMemberProps {
  readonly peerId: PeerId;
  readonly role: GroupMemberRole;
  readonly status: GroupMemberStatus;
  readonly joinedAt: Date;
  readonly removedAt?: Date;
}

export class GroupMember {
  private props: GroupMemberProps;
  private constructor(props: GroupMemberProps) { this.props = props; }
  static active(peerId: PeerId, role: GroupMemberRole, joinedAt: Date): GroupMember {
    return new GroupMember({ peerId, role, status: 'active', joinedAt });
  }
  static rehydrate(props: GroupMemberProps): GroupMember { return new GroupMember(props); }
  remove(removedAt: Date): void { this.props = { ...this.props, status: 'removed', removedAt }; }
  get snapshot(): GroupMemberProps { return this.props; }
}

export interface GroupProps {
  readonly id: GroupId;
  readonly name: GroupName;
  readonly members: readonly GroupMember[];
  readonly keyEpoch: GroupKeyEpoch;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export class Group extends AggregateRoot {
  private props: GroupProps;
  private constructor(props: GroupProps) { super(); this.props = props; }

  static create(props: { id: GroupId; name: GroupName; ownerPeerId: PeerId; createdAt: Date }, eventId: string): Group {
    const owner = GroupMember.active(props.ownerPeerId, 'owner', props.createdAt);
    const group = new Group({ id: props.id, name: props.name, members: [owner], keyEpoch: GroupKeyEpoch.initial(), createdAt: props.createdAt, updatedAt: props.createdAt });
    group.record({ id: eventId, name: 'GroupCreated', occurredAt: props.createdAt, payload: { groupId: props.id.value, ownerPeerId: props.ownerPeerId.value } });
    return group;
  }

  static rehydrate(props: GroupProps): Group { return new Group(props); }

  hasActiveMember(peerId: PeerId): boolean {
    return this.props.members.some((member) => member.snapshot.peerId.value === peerId.value && member.snapshot.status === 'active');
  }

  addMember(peerId: PeerId, now: Date, eventId: string): void {
    if (this.hasActiveMember(peerId)) throw new DomainError('Peer is already an active group member', 'group.member_already_active');
    const existingMembers = this.props.members.filter((member) => member.snapshot.peerId.value !== peerId.value);
    const member = GroupMember.active(peerId, 'member', now);
    this.props = { ...this.props, members: [...existingMembers, member], updatedAt: now };
    this.record({ id: eventId, name: 'GroupMemberAdded', occurredAt: now, payload: { groupId: this.props.id.value, peerId: peerId.value } });
  }

  removeMember(peerId: PeerId, now: Date, eventId: string): void {
    const member = this.props.members.find((candidate) => candidate.snapshot.peerId.value === peerId.value && candidate.snapshot.status === 'active');
    if (!member) throw new DomainError('Peer is not an active group member', 'group.member_not_active');
    if (member.snapshot.role === 'owner') throw new DomainError('Group owner cannot be removed in this phase', 'group.owner_remove_forbidden');
    member.remove(now);
    this.rotateKeys(now, eventId);
  }

  rotateKeys(now: Date, eventId: string): void {
    const nextEpoch = this.props.keyEpoch.next();
    this.props = { ...this.props, keyEpoch: nextEpoch, updatedAt: now };
    this.record({ id: eventId, name: 'GroupKeysRotated', occurredAt: now, payload: { groupId: this.props.id.value, epoch: nextEpoch.value } });
  }

  get snapshot(): GroupProps { return this.props; }
}
