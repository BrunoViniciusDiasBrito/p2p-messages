import { describe, expect, it } from 'vitest';
import { ConversationId, LamportClock, Message, MessageBody, MessageId, PeerId } from '../index.js';

describe('Message', () => {
  it('queues direct messages and emits a domain event', () => {
    const now = new Date();
    const message = Message.queueDirectDraft({
      id: MessageId.create('msg_1'),
      conversationId: ConversationId.create('cnv_1'),
      fromPeerId: PeerId.create('pc_senderpeer12345'),
      toPeerId: PeerId.create('pc_targetpeer12345'),
      body: MessageBody.create('hello'),
      lamportClock: LamportClock.initial(),
      createdAt: now,
      updatedAt: now
    }, 'evt_1');

    expect(message.snapshot.status).toBe('queued');
    expect(message.pullDomainEvents()[0]?.name).toBe('DirectMessageQueued');
  });
});
