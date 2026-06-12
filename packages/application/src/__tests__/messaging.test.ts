import { describe, expect, it } from 'vitest';
import { Contact, Conversation, ConversationId, InboxEntry, Message, OutboxEntry, PeerId } from '@peercomms/domain';
import { NoopDomainEventBus, ReceiveDirectMessageUseCase, SendDirectMessageUseCase, RetryOutboxMessagesUseCase, type ConversationRepository, type DirectMessageCryptoPort, type EnvelopePublisherPort, type IdGenerator, type InboxRepository, type MessageRepository, type OutboxRepository } from '../index.js';
import type { ContactRepository } from '../ports/contact-ports.js';


class InMemoryConversationRepository implements ConversationRepository {
  private readonly rows = new Map<string, Conversation>();
  async save(conversation: Conversation): Promise<void> { this.rows.set(conversation.snapshot.id.value, conversation); }
  async findDirectByPeerId(peerId: PeerId): Promise<Conversation | null> {
    return [...this.rows.values()].find((conversation) => conversation.snapshot.type === 'direct' && conversation.snapshot.peerId?.value === peerId.value) ?? null;
  }
  async findById(id: ConversationId): Promise<Conversation | null> { return this.rows.get(id.value) ?? null; }
  async list(): Promise<Conversation[]> { return [...this.rows.values()]; }
}

class InMemoryMessageRepository implements MessageRepository {
  private readonly rows = new Map<string, Message>();
  async save(message: Message): Promise<void> { this.rows.set(message.snapshot.id.value, message); }
  async findById(messageId: string): Promise<Message | null> { return this.rows.get(messageId) ?? null; }
  async listByConversationId(conversationId: ConversationId): Promise<Message[]> {
    return [...this.rows.values()].filter((message) => message.snapshot.conversationId.value === conversationId.value);
  }
}


class InMemoryInboxRepository implements InboxRepository {
  private readonly rows = new Map<string, InboxEntry>();
  async save(entry: InboxEntry): Promise<void> { this.rows.set(entry.snapshot.envelopeId, entry); }
  async exists(envelopeId: string): Promise<boolean> { return this.rows.has(envelopeId); }
}

class InMemoryOutboxRepository implements OutboxRepository {
  private readonly rows = new Map<string, OutboxEntry>();
  async save(entry: OutboxEntry): Promise<void> { this.rows.set(entry.snapshot.envelopeId, entry); }
  async findDue(now: Date, limit: number): Promise<OutboxEntry[]> {
    return [...this.rows.values()]
      .filter((entry) => ['queued_until_reachable', 'ready_to_publish'].includes(entry.snapshot.status) && (!entry.snapshot.nextAttemptAt || entry.snapshot.nextAttemptAt <= now))
      .slice(0, limit);
  }
  async list(): Promise<OutboxEntry[]> { return [...this.rows.values()]; }
}

class FixedIds implements IdGenerator {
  private next = 0;
  newId(prefix = 'id'): string { this.next += 1; return `${prefix}_${this.next}`; }
}

class Contacts implements ContactRepository {
  private readonly rows = new Map<string, Contact>();
  async save(contact: Contact): Promise<void> { this.rows.set(contact.snapshot.peerId.value, contact); }
  async findByPeerId(peerId: PeerId): Promise<Contact | null> { return this.rows.get(peerId.value) ?? null; }
  async list(): Promise<Contact[]> { return [...this.rows.values()]; }
}

const crypto: DirectMessageCryptoPort = {
  async encryptDirect(input) { return { encryptedPayload: `ciphertext_${Buffer.from(input.plaintext).toString('base64')}`, nonce: 'nonce_1234567890123456' }; },
  async decryptDirect(input) { return Buffer.from(input.encryptedPayload.replace('ciphertext_', ''), 'base64').toString('utf8'); },
  async signEnvelope() { return 'signature_123456789012345678901234'; },
  async verifyEnvelopeSignature() { return true; }
};

describe('messaging use cases', () => {
  it('queues encrypted direct messages into outbox for accepted contacts', async () => {
    const contacts = new Contacts();
    await contacts.save(Contact.accepted(PeerId.create('pc_targetpeer123456'), new Date()));
    const outbox = new InMemoryOutboxRepository();
    const result = await new SendDirectMessageUseCase(
      contacts,
      new InMemoryConversationRepository(),
      new InMemoryMessageRepository(),
      outbox,
      crypto,
      new NoopDomainEventBus(),
      new FixedIds()
    ).execute({ fromPeerId: 'pc_senderpeer123456', toPeerId: 'pc_targetpeer123456', text: 'Olá' });

    expect(result.ok).toBe(true);
    expect((await outbox.list())[0]?.snapshot.status).toBe('queued_until_reachable');
  });



  it('deduplicates already processed direct message envelopes', async () => {
    const contactsA = new Contacts();
    const contactsB = new Contacts();
    await contactsA.save(Contact.accepted(PeerId.create('pc_targetpeer123456'), new Date()));
    await contactsB.save(Contact.accepted(PeerId.create('pc_senderpeer123456'), new Date()));
    const outbox = new InMemoryOutboxRepository();
    await new SendDirectMessageUseCase(contactsA, new InMemoryConversationRepository(), new InMemoryMessageRepository(), outbox, crypto, new NoopDomainEventBus(), new FixedIds())
      .execute({ fromPeerId: 'pc_senderpeer123456', toPeerId: 'pc_targetpeer123456', text: 'Olá' });
    const envelope = JSON.parse((await outbox.list())[0]!.snapshot.envelopeJson);
    const inbox = new InMemoryInboxRepository();
    const receiver = new ReceiveDirectMessageUseCase(contactsB, new InMemoryConversationRepository(), new InMemoryMessageRepository(), inbox, crypto, new NoopDomainEventBus(), new FixedIds());

    const first = await receiver.execute({ localPeerId: 'pc_targetpeer123456', envelope, receivedAt: new Date() });
    const second = await receiver.execute({ localPeerId: 'pc_targetpeer123456', envelope, receivedAt: new Date() });

    expect(first.ok && first.value.duplicate).toBe(false);
    expect(second.ok && second.value).toEqual({ messageId: envelope.envelopeId, duplicate: true });
  });

  it('rejects expired direct message envelopes before decrypting', async () => {
    const contactsA = new Contacts();
    const contactsB = new Contacts();
    await contactsA.save(Contact.accepted(PeerId.create('pc_targetpeer123456'), new Date()));
    await contactsB.save(Contact.accepted(PeerId.create('pc_senderpeer123456'), new Date()));
    const outbox = new InMemoryOutboxRepository();
    await new SendDirectMessageUseCase(contactsA, new InMemoryConversationRepository(), new InMemoryMessageRepository(), outbox, crypto, new NoopDomainEventBus(), new FixedIds())
      .execute({ fromPeerId: 'pc_senderpeer123456', toPeerId: 'pc_targetpeer123456', text: 'Olá', expiresAt: new Date('2026-06-12T00:00:00.000Z') });
    const envelope = JSON.parse((await outbox.list())[0]!.snapshot.envelopeJson);

    const result = await new ReceiveDirectMessageUseCase(contactsB, new InMemoryConversationRepository(), new InMemoryMessageRepository(), new InMemoryInboxRepository(), crypto, new NoopDomainEventBus(), new FixedIds())
      .execute({ localPeerId: 'pc_targetpeer123456', envelope, receivedAt: new Date('2026-06-12T00:00:01.000Z') });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.message).toBe('Expired direct message envelope');
  });

  it('rejects tampered direct message envelope signatures', async () => {
    const contactsA = new Contacts();
    const contactsB = new Contacts();
    await contactsA.save(Contact.accepted(PeerId.create('pc_targetpeer123456'), new Date()));
    await contactsB.save(Contact.accepted(PeerId.create('pc_senderpeer123456'), new Date()));
    const outbox = new InMemoryOutboxRepository();
    await new SendDirectMessageUseCase(contactsA, new InMemoryConversationRepository(), new InMemoryMessageRepository(), outbox, crypto, new NoopDomainEventBus(), new FixedIds())
      .execute({ fromPeerId: 'pc_senderpeer123456', toPeerId: 'pc_targetpeer123456', text: 'Olá' });
    const envelope = { ...JSON.parse((await outbox.list())[0]!.snapshot.envelopeJson), payload: 'ciphertext_dGFtcGVyZWQ=' };
    const rejectingCrypto: DirectMessageCryptoPort = { ...crypto, async verifyEnvelopeSignature() { return false; } };

    const result = await new ReceiveDirectMessageUseCase(contactsB, new InMemoryConversationRepository(), new InMemoryMessageRepository(), new InMemoryInboxRepository(), rejectingCrypto, new NoopDomainEventBus(), new FixedIds())
      .execute({ localPeerId: 'pc_targetpeer123456', envelope, receivedAt: new Date() });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.message).toBe('Invalid direct message envelope signature');
  });

  it('retries due outbox messages with publisher port', async () => {
    const publisher: EnvelopePublisherPort = { async publish() { return 'published'; } };
    const outbox = new InMemoryOutboxRepository();
    const contacts = new Contacts();
    await contacts.save(Contact.accepted(PeerId.create('pc_targetpeer123456'), new Date()));
    await new SendDirectMessageUseCase(contacts, new InMemoryConversationRepository(), new InMemoryMessageRepository(), outbox, crypto, new NoopDomainEventBus(), new FixedIds())
      .execute({ fromPeerId: 'pc_senderpeer123456', toPeerId: 'pc_targetpeer123456', text: 'Olá' });

    const result = await new RetryOutboxMessagesUseCase(outbox, publisher).execute({ now: new Date() });
    expect(result.ok && result.value.published).toBe(1);
  });
});
