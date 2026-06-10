import { ContactRepository } from '../ports/contact-ports.js';
import { DomainEventBus } from '../ports/event-bus.js';
import { IdGenerator } from '../ports/id-generator.js';
import { ConversationRepository, DirectMessageCryptoPort, EnvelopePublisherPort, InboxRepository, MessageRepository, OutboxRepository } from '../ports/messaging-ports.js';
import { Conversation, ConversationId, EncryptedPayload, InboxEntry, LamportClock, Message, MessageBody, MessageId, OutboxEntry, PeerId, Result, err, ok } from '@peercomms/domain';

export interface DirectMessageEnvelopeDto {
  readonly protocolVersion: '1.0';
  readonly envelopeId: string;
  readonly type: 'direct_message';
  readonly fromPeerId: string;
  readonly toPeerId: string;
  readonly conversationId: string;
  readonly createdAt: string;
  readonly expiresAt?: string;
  readonly nonce: string;
  readonly payload: string;
  readonly signature: string;
}

const canonicalizeUnsignedEnvelope = (envelope: Omit<DirectMessageEnvelopeDto, 'signature'>): string => JSON.stringify(envelope);
const serializeEnvelope = (envelope: DirectMessageEnvelopeDto): string => JSON.stringify(envelope);

export class SendDirectMessageUseCase {
  constructor(
    private readonly contacts: ContactRepository,
    private readonly conversations: ConversationRepository,
    private readonly messages: MessageRepository,
    private readonly outbox: OutboxRepository,
    private readonly crypto: DirectMessageCryptoPort,
    private readonly events: DomainEventBus,
    private readonly ids: IdGenerator
  ) {}

  async execute(input: { fromPeerId: string; toPeerId: string; text: string; expiresAt?: Date }): Promise<Result<{ messageId: string; envelopeId: string; status: 'queued_until_reachable' }>> {
    const now = new Date();
    const toPeerId = PeerId.create(input.toPeerId);
    const fromPeerId = PeerId.create(input.fromPeerId);
    const contact = await this.contacts.findByPeerId(toPeerId);
    if (!contact?.canReceiveDirectMessages()) return err(new Error('Direct messages require an accepted, non-blocked contact'));

    let conversation = await this.conversations.findDirectByPeerId(toPeerId);
    if (!conversation) {
      conversation = Conversation.direct(ConversationId.create(this.ids.newId('cnv')), toPeerId, now);
      await this.conversations.save(conversation);
    }
    const lamportClock = conversation.tick(now);
    await this.conversations.save(conversation);

    const message = Message.queueDirectDraft({
      id: MessageId.create(this.ids.newId('msg')),
      conversationId: conversation.snapshot.id,
      fromPeerId,
      toPeerId,
      body: MessageBody.create(input.text),
      lamportClock,
      createdAt: now,
      updatedAt: now
    }, this.ids.newId('evt'));

    const encrypted = await this.crypto.encryptDirect({ plaintext: input.text, fromPeerId: input.fromPeerId, toPeerId: input.toPeerId });
    message.markEncrypted(EncryptedPayload.create(encrypted.encryptedPayload), now, this.ids.newId('evt'));

    const unsignedEnvelope: Omit<DirectMessageEnvelopeDto, 'signature'> = {
      protocolVersion: '1.0',
      envelopeId: this.ids.newId('env'),
      type: 'direct_message',
      fromPeerId: input.fromPeerId,
      toPeerId: input.toPeerId,
      conversationId: conversation.snapshot.id.value,
      createdAt: now.toISOString(),
      ...(input.expiresAt ? { expiresAt: input.expiresAt.toISOString() } : {}),
      nonce: encrypted.nonce,
      payload: encrypted.encryptedPayload
    };
    const signature = await this.crypto.signEnvelope({ canonicalEnvelope: canonicalizeUnsignedEnvelope(unsignedEnvelope), fromPeerId: input.fromPeerId });
    const envelope = { ...unsignedEnvelope, signature };
    const outboxEntry = OutboxEntry.queue({ envelopeId: envelope.envelopeId, toPeerId: input.toPeerId, envelopeJson: serializeEnvelope(envelope), createdAt: now });

    await this.messages.save(message);
    await this.outbox.save(outboxEntry);
    await this.events.publish(message.pullDomainEvents());
    return ok({ messageId: message.snapshot.id.value, envelopeId: envelope.envelopeId, status: 'queued_until_reachable' });
  }
}

export class ReceiveDirectMessageUseCase {
  constructor(
    private readonly contacts: ContactRepository,
    private readonly conversations: ConversationRepository,
    private readonly messages: MessageRepository,
    private readonly inbox: InboxRepository,
    private readonly crypto: DirectMessageCryptoPort,
    private readonly events: DomainEventBus,
    private readonly ids: IdGenerator
  ) {}

  async execute(input: { localPeerId: string; envelope: DirectMessageEnvelopeDto }): Promise<Result<{ messageId: string; duplicate: boolean }>> {
    if (await this.inbox.exists(input.envelope.envelopeId)) return ok({ messageId: input.envelope.envelopeId, duplicate: true });
    if (input.envelope.toPeerId !== input.localPeerId) return err(new Error('Envelope recipient does not match local peer'));
    const fromPeerId = PeerId.create(input.envelope.fromPeerId);
    const contact = await this.contacts.findByPeerId(fromPeerId);
    if (!contact?.canReceiveDirectMessages()) return err(new Error('Inbound direct messages require an accepted, non-blocked contact'));

    const { signature, ...unsignedEnvelope } = input.envelope;
    const valid = await this.crypto.verifyEnvelopeSignature({ canonicalEnvelope: canonicalizeUnsignedEnvelope(unsignedEnvelope), signature, fromPeerId: input.envelope.fromPeerId });
    if (!valid) return err(new Error('Invalid direct message envelope signature'));

    const now = new Date();
    await this.inbox.save(InboxEntry.receive({ envelopeId: input.envelope.envelopeId, fromPeerId: input.envelope.fromPeerId, envelopeJson: serializeEnvelope(input.envelope), receivedAt: now }));

    let conversation = await this.conversations.findDirectByPeerId(fromPeerId);
    if (!conversation) {
      conversation = Conversation.direct(ConversationId.create(input.envelope.conversationId), fromPeerId, now);
      await this.conversations.save(conversation);
    }

    const message = Message.receiveEncryptedDirect({
      id: MessageId.create(this.ids.newId('msg')),
      conversationId: conversation.snapshot.id,
      fromPeerId,
      toPeerId: PeerId.create(input.localPeerId),
      encryptedPayload: EncryptedPayload.create(input.envelope.payload),
      lamportClock: LamportClock.create(0),
      createdAt: new Date(input.envelope.createdAt),
      updatedAt: now
    }, this.ids.newId('evt'));
    const plaintext = await this.crypto.decryptDirect({ encryptedPayload: input.envelope.payload, fromPeerId: input.envelope.fromPeerId, toPeerId: input.localPeerId });
    message.markDecrypted(MessageBody.create(plaintext), now, this.ids.newId('evt'));
    await this.messages.save(message);
    await this.events.publish(message.pullDomainEvents());
    return ok({ messageId: message.snapshot.id.value, duplicate: false });
  }
}

export class ListConversationsUseCase {
  constructor(private readonly conversations: ConversationRepository) {}
  async execute(): Promise<Result<Array<{ id: string; type: string; peerId?: string; updatedAt: string }>>> {
    const conversations = await this.conversations.list();
    return ok(conversations.map((conversation) => ({
      id: conversation.snapshot.id.value,
      type: conversation.snapshot.type,
      ...(conversation.snapshot.peerId ? { peerId: conversation.snapshot.peerId.value } : {}),
      updatedAt: conversation.snapshot.updatedAt.toISOString()
    })));
  }
}

export class ListMessagesUseCase {
  constructor(private readonly messages: MessageRepository) {}
  async execute(input: { conversationId: string }): Promise<Result<Array<{ id: string; status: string; body?: string; createdAt: string }>>> {
    const messages = await this.messages.listByConversationId(ConversationId.create(input.conversationId));
    return ok(messages.map((message) => ({
      id: message.snapshot.id.value,
      status: message.snapshot.status,
      ...(message.snapshot.body ? { body: message.snapshot.body.value } : {}),
      createdAt: message.snapshot.createdAt.toISOString()
    })));
  }
}

export class MarkMessageAsReadUseCase {
  constructor(private readonly messages: MessageRepository) {}
  async execute(input: { messageId: string }): Promise<Result<void>> {
    const message = await this.messages.findById(input.messageId);
    if (!message) return err(new Error('Message not found'));
    message.markRead(new Date());
    await this.messages.save(message);
    return ok(undefined);
  }
}

export class RetryOutboxMessagesUseCase {
  constructor(private readonly outbox: OutboxRepository, private readonly publisher: EnvelopePublisherPort) {}
  async execute(input: { now?: Date; limit?: number }): Promise<Result<{ published: number; queued: number }>> {
    const now = input.now ?? new Date();
    const due = await this.outbox.findDue(now, input.limit ?? 50);
    let published = 0;
    let queued = 0;
    for (const entry of due) {
      entry.markReady(now);
      const result = await this.publisher.publish(entry.snapshot.envelopeJson);
      if (result === 'published') {
        entry.markPublished(now);
        published += 1;
      } else {
        const backoffMs = Math.min(60_000, 1000 * 2 ** entry.snapshot.retryCount);
        entry.scheduleRetry(new Date(now.getTime() + backoffMs), now);
        queued += 1;
      }
      await this.outbox.save(entry);
    }
    return ok({ published, queued });
  }
}
