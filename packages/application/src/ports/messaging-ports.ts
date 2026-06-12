import { Conversation, ConversationId, InboxEntry, Message, OutboxEntry, PeerId } from '@peercomms/domain';

export interface ConversationRepository {
  save(conversation: Conversation): Promise<void>;
  findDirectByPeerId(peerId: PeerId): Promise<Conversation | null>;
  findById(id: ConversationId): Promise<Conversation | null>;
  list(): Promise<Conversation[]>;
}

export interface MessageRepository {
  save(message: Message): Promise<void>;
  findById(messageId: string): Promise<Message | null>;
  listByConversationId(conversationId: ConversationId): Promise<Message[]>;
}

export interface OutboxRepository {
  save(entry: OutboxEntry): Promise<void>;
  findDue(now: Date, limit: number): Promise<OutboxEntry[]>;
  list(): Promise<OutboxEntry[]>;
}

export interface InboxRepository {
  save(entry: InboxEntry): Promise<void>;
  exists(envelopeId: string): Promise<boolean>;
}

export interface DirectMessageCryptoPort {
  encryptDirect(input: { plaintext: string; fromPeerId: string; toPeerId: string }): Promise<{ encryptedPayload: string; nonce: string }>;
  decryptDirect(input: { encryptedPayload: string; fromPeerId: string; toPeerId: string; nonce?: string }): Promise<string>;
  signEnvelope(input: { canonicalEnvelope: string; fromPeerId: string }): Promise<string>;
  verifyEnvelopeSignature(input: { canonicalEnvelope: string; signature: string; fromPeerId: string }): Promise<boolean>;
}

export interface EnvelopePublisherPort {
  publish(envelopeJson: string): Promise<'published' | 'peer_unreachable'>;
}
