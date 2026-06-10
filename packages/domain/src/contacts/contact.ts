import { AggregateRoot } from '../shared/domain-event.js';
import { PeerId } from '../shared/ids.js';

export type ContactStatus = 'accepted' | 'blocked' | 'revoked';

export interface ContactProps {
  readonly peerId: PeerId;
  readonly alias?: string;
  readonly status: ContactStatus;
  readonly trustedSince?: Date;
  readonly updatedAt: Date;
}

export class Contact extends AggregateRoot {
  private props: ContactProps;
  private constructor(props: ContactProps) { super(); this.props = props; }
  static accepted(peerId: PeerId, now: Date): Contact { return new Contact({ peerId, status: 'accepted', trustedSince: now, updatedAt: now }); }
  static rehydrate(props: ContactProps): Contact { return new Contact(props); }
  block(now: Date, eventId: string): void {
    this.props = { ...this.props, status: 'blocked', updatedAt: now };
    this.record({ id: eventId, name: 'ContactBlocked', occurredAt: now, payload: { peerId: this.props.peerId.value } });
  }
  canReceiveDirectMessages(): boolean { return this.props.status === 'accepted'; }
  get snapshot(): ContactProps { return this.props; }
}
