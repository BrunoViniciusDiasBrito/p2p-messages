import { describe, expect, it } from 'vitest';
import { Contact, Conversation, ConversationId, Message, OutboxEntry, PeerId } from '@peercomms/domain';
import { NoopDomainEventBus, SendDirectMessageUseCase, RetryOutboxMessagesUseCase, type ConversationRepository, type DirectMessageCryptoPort, type EnvelopePublisherPort, type IdGenerator, type MessageRepository, type OutboxRepository } from '../index.js';
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
