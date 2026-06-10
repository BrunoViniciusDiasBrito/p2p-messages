import { AggregateRoot } from '../shared/domain-event.js';
import { DomainError } from '../shared/domain-error.js';
import { ContactRequestId, PeerId } from '../shared/ids.js';

export type ContactRequestStatus = 'pending_inbound' | 'pending_outbound' | 'accepted' | 'rejected' | 'blocked' | 'revoked';

export interface ContactRequestProps {
  readonly id: ContactRequestId;
  readonly localPeerId: PeerId;
  readonly remotePeerId: PeerId;
  readonly status: ContactRequestStatus;
  readonly message?: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export class ContactRequest extends AggregateRoot {
  private props: ContactRequestProps;
  private constructor(props: ContactRequestProps) { super(); this.props = props; }

  static outbound(props: Omit<ContactRequestProps, 'status'>, eventId: string): ContactRequest {
    const request = new ContactRequest({ ...props, status: 'pending_outbound' });
    request.record({ id: eventId, name: 'ContactRequestSent', occurredAt: props.createdAt, payload: { requestId: props.id.value, toPeerId: props.remotePeerId.value } });
    return request;
  }

  static inbound(props: Omit<ContactRequestProps, 'status'>, eventId: string): ContactRequest {
    const request = new ContactRequest({ ...props, status: 'pending_inbound' });
    request.record({ id: eventId, name: 'ContactRequestReceived', occurredAt: props.createdAt, payload: { requestId: props.id.value, fromPeerId: props.remotePeerId.value } });
    return request;
  }

  static rehydrate(props: ContactRequestProps): ContactRequest { return new ContactRequest(props); }

  approve(now: Date, eventId: string): void {
    if (this.props.status !== 'pending_inbound') throw new DomainError('Only inbound pending requests can be approved locally', 'contact_request.not_approvable');
    this.props = { ...this.props, status: 'accepted', updatedAt: now };
    this.record({ id: eventId, name: 'ContactRequestApproved', occurredAt: now, payload: { requestId: this.props.id.value, peerId: this.props.remotePeerId.value } });
  }

  reject(now: Date): void {
    if (!this.props.status.startsWith('pending')) throw new DomainError('Only pending requests can be rejected', 'contact_request.not_rejectable');
    this.props = { ...this.props, status: 'rejected', updatedAt: now };
  }

  get snapshot(): ContactRequestProps { return this.props; }
}
