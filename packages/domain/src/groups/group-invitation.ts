import { AggregateRoot } from '../shared/domain-event.js';
import { DomainError } from '../shared/domain-error.js';
import { PeerId } from '../shared/ids.js';
import { GroupId, GroupInvitationId } from './value-objects.js';

export type GroupInvitationStatus = 'pending_outbound' | 'pending_inbound' | 'accepted' | 'rejected' | 'revoked';

export interface GroupInvitationProps {
  readonly id: GroupInvitationId;
  readonly groupId: GroupId;
  readonly inviterPeerId: PeerId;
  readonly inviteePeerId: PeerId;
  readonly status: GroupInvitationStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export class GroupInvitation extends AggregateRoot {
  private props: GroupInvitationProps;
  private constructor(props: GroupInvitationProps) { super(); this.props = props; }

  static outbound(props: Omit<GroupInvitationProps, 'status'>): GroupInvitation {
    return new GroupInvitation({ ...props, status: 'pending_outbound' });
  }

  static inbound(props: Omit<GroupInvitationProps, 'status'>, eventId: string): GroupInvitation {
    const invitation = new GroupInvitation({ ...props, status: 'pending_inbound' });
    invitation.record({ id: eventId, name: 'GroupInvitationReceived', occurredAt: props.createdAt, payload: { invitationId: props.id.value, groupId: props.groupId.value, inviterPeerId: props.inviterPeerId.value } });
    return invitation;
  }

  static rehydrate(props: GroupInvitationProps): GroupInvitation { return new GroupInvitation(props); }

  accept(now: Date, eventId: string): void {
    if (this.props.status !== 'pending_inbound') throw new DomainError('Only inbound pending group invitations can be accepted locally', 'group_invitation.not_acceptable');
    this.props = { ...this.props, status: 'accepted', updatedAt: now };
    this.record({ id: eventId, name: 'GroupInvitationAccepted', occurredAt: now, payload: { invitationId: this.props.id.value, groupId: this.props.groupId.value } });
  }

  reject(now: Date): void {
    if (!this.props.status.startsWith('pending')) throw new DomainError('Only pending group invitations can be rejected', 'group_invitation.not_rejectable');
    this.props = { ...this.props, status: 'rejected', updatedAt: now };
  }

  get snapshot(): GroupInvitationProps { return this.props; }
}
