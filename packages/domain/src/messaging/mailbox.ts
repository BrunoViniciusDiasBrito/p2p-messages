import { DomainError } from '../shared/domain-error.js';

export type OutboxStatus = 'queued_until_reachable' | 'ready_to_publish' | 'published' | 'failed' | 'expired';

export interface OutboxEntryProps {
  readonly envelopeId: string;
  readonly toPeerId?: string;
  readonly envelopeJson: string;
  readonly status: OutboxStatus;
  readonly retryCount: number;
  readonly nextAttemptAt?: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export class OutboxEntry {
  private props: OutboxEntryProps;
  private constructor(props: OutboxEntryProps) { this.props = props; }

  static queue(props: Omit<OutboxEntryProps, 'status' | 'retryCount' | 'nextAttemptAt' | 'updatedAt'>): OutboxEntry {
    if (!props.envelopeJson.trim()) throw new DomainError('Outbox envelope cannot be empty', 'outbox.envelope_empty');
    return new OutboxEntry({ ...props, status: 'queued_until_reachable', retryCount: 0, updatedAt: props.createdAt });
  }

  static rehydrate(props: OutboxEntryProps): OutboxEntry { return new OutboxEntry(props); }

  scheduleRetry(nextAttemptAt: Date, now: Date): void {
    this.props = { ...this.props, retryCount: this.props.retryCount + 1, nextAttemptAt, status: 'queued_until_reachable', updatedAt: now };
  }

  markReady(now: Date): void { this.props = { ...this.props, status: 'ready_to_publish', updatedAt: now }; }
  markPublished(now: Date): void { this.props = { ...this.props, status: 'published', updatedAt: now }; }
  fail(now: Date): void { this.props = { ...this.props, status: 'failed', updatedAt: now }; }
  get snapshot(): OutboxEntryProps { return this.props; }
}

export interface InboxEntryProps {
  readonly envelopeId: string;
  readonly fromPeerId: string;
  readonly envelopeJson: string;
  readonly receivedAt: Date;
  readonly processedAt?: Date;
}

export class InboxEntry {
  private props: InboxEntryProps;
  private constructor(props: InboxEntryProps) { this.props = props; }
  static receive(props: InboxEntryProps): InboxEntry { return new InboxEntry(props); }
  static rehydrate(props: InboxEntryProps): InboxEntry { return new InboxEntry(props); }
  markProcessed(processedAt: Date): void { this.props = { ...this.props, processedAt }; }
  get snapshot(): InboxEntryProps { return this.props; }
}
