import { describe, expect, it } from 'vitest';
import { Contact, PeerId } from '@peercomms/domain';
import {
  DirectMessageIncomingEnvelopeProcessor,
  NoopDomainEventBus,
  PeerNodeEnvelopePublisher,
  ReceiveDirectMessageUseCase,
  RetryOutboxMessagesUseCase,
  SendDirectMessageUseCase,
  type DirectMessageCryptoPort,
  type IdGenerator
} from '@peercomms/application';
import {
  InMemoryContactRepository,
  InMemoryConversationRepository,
  InMemoryInboxRepository,
  InMemoryMessageRepository,
  InMemoryOutboxRepository
} from '@peercomms/testing';
import { InMemoryPeerNetwork, InMemoryPeerNodeRuntime } from '../index.js';

class SequentialIds implements IdGenerator {
  private next = 0;
  newId(prefix = 'id'): string {
    this.next += 1;
    if (prefix === 'env') return `envelope_${this.next.toString().padStart(8, '0')}`;
    return `${prefix}_${this.next}`;
  }
}

const crypto: DirectMessageCryptoPort = {
  async encryptDirect(input) { return { encryptedPayload: `ciphertext_${Buffer.from(input.plaintext).toString('base64')}`, nonce: 'nonce_1234567890123456' }; },
  async decryptDirect(input) { return Buffer.from(input.encryptedPayload.replace('ciphertext_', ''), 'base64').toString('utf8'); },
  async signEnvelope() { return 'signature_123456789012345678901234'; },
  async verifyEnvelopeSignature() { return true; }
};

describe('in-memory P2P direct messaging composition', () => {
  it('delivers a queued direct message from node A to node B through retry/outbox and the P2P runtime', async () => {
    const peerA = 'pc_nodeapeer123456767';
    const peerB = 'pc_nodebpeer123456767';
    const now = new Date('2026-06-12T00:00:00.000Z');

    const contactsA = new InMemoryContactRepository();
    const contactsB = new InMemoryContactRepository();
    await contactsA.save(Contact.accepted(PeerId.create(peerB), now));
    await contactsB.save(Contact.accepted(PeerId.create(peerA), now));

    const conversationsA = new InMemoryConversationRepository();
    const conversationsB = new InMemoryConversationRepository();
    const messagesA = new InMemoryMessageRepository();
    const messagesB = new InMemoryMessageRepository();
    const outboxA = new InMemoryOutboxRepository();
    const inboxB = new InMemoryInboxRepository();

    const receiveOnB = new ReceiveDirectMessageUseCase(contactsB, conversationsB, messagesB, inboxB, crypto, new NoopDomainEventBus(), new SequentialIds());
    const network = new InMemoryPeerNetwork();
    const nodeB = new InMemoryPeerNodeRuntime(network, new DirectMessageIncomingEnvelopeProcessor(peerB, receiveOnB));
    const nodeA = new InMemoryPeerNodeRuntime(network, { async handle() { throw new Error('Node A should not receive in this scenario'); } });

    await nodeA.start({ localPeerId: peerA, mode: 'local_lan' });
    await nodeB.start({ localPeerId: peerB, mode: 'local_lan' });
    await nodeA.connectToPeer(peerB);

    const sendResult = await new SendDirectMessageUseCase(contactsA, conversationsA, messagesA, outboxA, crypto, new NoopDomainEventBus(), new SequentialIds())
      .execute({ fromPeerId: peerA, toPeerId: peerB, text: 'Olá por P2P local' });
    expect(sendResult.ok).toBe(true);

    const retryResult = await new RetryOutboxMessagesUseCase(outboxA, new PeerNodeEnvelopePublisher(nodeA)).execute({ now });
    expect(retryResult.ok && retryResult.value).toEqual({ published: 1, queued: 0 });

    const conversations = await conversationsB.list();
    expect(conversations).toHaveLength(1);
    const receivedMessages = await messagesB.listByConversationId(conversations[0]!.snapshot.id);
    expect(receivedMessages[0]?.snapshot.status).toBe('decrypted');
    expect(receivedMessages[0]?.snapshot.body?.value).toBe('Olá por P2P local');
  });
});
