import { AggregateRoot } from '../shared/domain-event.js';
import { DomainError } from '../shared/domain-error.js';
import { PeerId } from '../shared/ids.js';
import { ConversationId, EncryptedPayload, LamportClock, MessageBody, MessageId } from './value-objects.js';

export type MessageStatus =
  | 'draft'
  | 'queued'
  | 'encrypted'
  | 'sent_to_transport'
  | 'received_by_peer'
  | 'decrypted'
  | 'read'
  | 'failed'
  | 'expired';

export interface MessageProps {
  readonly id: MessageId;
  readonly conversationId: ConversationId;
  readonly fromPeerId: PeerId;
  readonly toPeerId?: PeerId;
  readonly body?: MessageBody;
  readonly encryptedPayload?: EncryptedPayload;
  readonly status: MessageStatus;
  readonly lamportClock: LamportClock;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export class Message extends AggregateRoot {
  private props: MessageProps;
  private constructor(props: MessageProps) { super(); this.props = props; }

  static queueDirectDraft(props: Omit<MessageProps, 'status' | 'encryptedPayload'>, eventId: string): Message {
    if (!props.toPeerId) throw new DomainError('Direct messages require recipient peer id', 'message.recipient_required');
    if (!props.body) throw new DomainError('Draft direct messages require a body', 'message.body_required');
    const message = new Message({ ...props, status: 'queued' });
    message.record({
      id: eventId,
      name: 'DirectMessageQueued',
      occurredAt: props.createdAt,
      payload: { messageId: props.id.value, conversationId: props.conversationId.value, toPeerId: props.toPeerId.value }
    });
    return message;
  }

  static receiveEncryptedDirect(props: Omit<MessageProps, 'status' | 'body'>, eventId: string): Message {
    if (!props.encryptedPayload) throw new DomainError('Received messages require encrypted payload', 'message.encrypted_payload_required');
    const message = new Message({ ...props, status: 'received_by_peer' });
    message.record({
      id: eventId,
      name: 'DirectMessageReceived',
      occurredAt: props.createdAt,
      payload: { messageId: props.id.value, conversationId: props.conversationId.value, fromPeerId: props.fromPeerId.value }
    });
    return message;
  }

  static rehydrate(props: MessageProps): Message { return new Message(props); }

  markEncrypted(payload: EncryptedPayload, now: Date, eventId: string): void {
    if (this.props.status !== 'queued') throw new DomainError('Only queued messages can be encrypted', 'message.not_encryptable');
    this.props = { ...this.props, encryptedPayload: payload, status: 'encrypted', updatedAt: now };
    this.record({ id: eventId, name: 'DirectMessageEncrypted', occurredAt: now, payload: { messageId: this.props.id.value } });
  }

  markSentToTransport(now: Date): void {
    if (this.props.status !== 'encrypted') throw new DomainError('Only encrypted messages can be sent to transport', 'message.not_sendable');
    this.props = { ...this.props, status: 'sent_to_transport', updatedAt: now };
  }

  markDecrypted(body: MessageBody, now: Date, eventId: string): void {
    if (this.props.status !== 'received_by_peer') throw new DomainError('Only received messages can be decrypted', 'message.not_decryptable');
    this.props = { ...this.props, body, status: 'decrypted', updatedAt: now };
    this.record({ id: eventId, name: 'DirectMessageDecrypted', occurredAt: now, payload: { messageId: this.props.id.value } });
  }

  markRead(now: Date): void {
    if (!['decrypted', 'received_by_peer'].includes(this.props.status)) throw new DomainError('Only received/decrypted messages can be marked read', 'message.not_readable');
    this.props = { ...this.props, status: 'read', updatedAt: now };
  }

  fail(now: Date): void { this.props = { ...this.props, status: 'failed', updatedAt: now }; }

  get snapshot(): MessageProps { return this.props; }
}
