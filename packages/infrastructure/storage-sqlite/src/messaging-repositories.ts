import { Conversation, ConversationId, EncryptedPayload, InboxEntry, LamportClock, Message, MessageId, OutboxEntry, PeerId } from '@peercomms/domain';
import { ConversationRepository, InboxRepository, MessageRepository, OutboxRepository } from '@peercomms/application';
import { fromIso, nullableString, SqliteDatabasePort, SqliteRow, toIso } from './database.js';

interface ConversationRow extends SqliteRow {
  id: string;
  type: 'direct' | 'group';
  peer_id: string | null;
  group_id: string | null;
  lamport_clock: number;
  created_at: string;
  updated_at: string;
}

interface MessageRow extends SqliteRow {
  id: string;
  conversation_id: string;
  sender_peer_id: string;
  recipient_peer_id: string | null;
  status: 'draft' | 'queued' | 'encrypted' | 'sent_to_transport' | 'received_by_peer' | 'decrypted' | 'read' | 'failed' | 'expired';
  encrypted_payload: string | null;
  lamport_clock: number;
  created_at: string;
  updated_at: string;
}

interface OutboxRow extends SqliteRow {
  envelope_id: string;
  to_peer_id: string | null;
  envelope_json: string;
  status: 'queued_until_reachable' | 'ready_to_publish' | 'published' | 'failed' | 'expired';
  retry_count: number;
  next_attempt_at: string | null;
  created_at: string;
  updated_at: string;
}

interface InboxRow extends SqliteRow {
  envelope_id: string;
  from_peer_id: string;
  envelope_json: string;
  received_at: string;
  processed_at: string | null;
}

const mapConversation = (row: ConversationRow): Conversation => Conversation.rehydrate({
  id: ConversationId.create(row.id),
  type: row.type,
  ...(nullableString(row.peer_id) ? { peerId: PeerId.create(String(row.peer_id)) } : {}),
  ...(nullableString(row.group_id) ? { groupId: String(row.group_id) } : {}),
  lamportClock: LamportClock.create(Number(row.lamport_clock)),
  createdAt: fromIso(row.created_at),
  updatedAt: fromIso(row.updated_at)
});

const mapMessage = (row: MessageRow): Message => Message.rehydrate({
  id: MessageId.create(row.id),
  conversationId: ConversationId.create(row.conversation_id),
  fromPeerId: PeerId.create(row.sender_peer_id),
  ...(nullableString(row.recipient_peer_id) ? { toPeerId: PeerId.create(String(row.recipient_peer_id)) } : {}),
  ...(nullableString(row.encrypted_payload) ? { encryptedPayload: EncryptedPayload.create(String(row.encrypted_payload)) } : {}),
  status: row.status,
  lamportClock: LamportClock.create(Number(row.lamport_clock)),
  createdAt: fromIso(row.created_at),
  updatedAt: fromIso(row.updated_at)
});

const mapOutbox = (row: OutboxRow): OutboxEntry => OutboxEntry.rehydrate({
  envelopeId: row.envelope_id,
  ...(nullableString(row.to_peer_id) ? { toPeerId: String(row.to_peer_id) } : {}),
  envelopeJson: row.envelope_json,
  status: row.status,
  retryCount: Number(row.retry_count),
  ...(row.next_attempt_at ? { nextAttemptAt: fromIso(row.next_attempt_at) } : {}),
  createdAt: fromIso(row.created_at),
  updatedAt: fromIso(row.updated_at)
});

const mapInbox = (row: InboxRow): InboxEntry => InboxEntry.rehydrate({
  envelopeId: row.envelope_id,
  fromPeerId: row.from_peer_id,
  envelopeJson: row.envelope_json,
  receivedAt: fromIso(row.received_at),
  ...(row.processed_at ? { processedAt: fromIso(row.processed_at) } : {})
});

export class SqliteConversationRepository implements ConversationRepository {
  constructor(private readonly db: SqliteDatabasePort) {}
  async save(conversation: Conversation): Promise<void> {
    const snapshot = conversation.snapshot;
    await this.db.execute(
      `INSERT INTO conversations (id, type, peer_id, group_id, lamport_clock, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET type = excluded.type, peer_id = excluded.peer_id, group_id = excluded.group_id, lamport_clock = excluded.lamport_clock, updated_at = excluded.updated_at`,
      [snapshot.id.value, snapshot.type, snapshot.peerId?.value ?? null, snapshot.groupId ?? null, snapshot.lamportClock.value, snapshot.createdAt.toISOString(), snapshot.updatedAt.toISOString()]
    );
  }
  async findDirectByPeerId(peerId: PeerId): Promise<Conversation | null> {
    const row = await this.db.queryOne<ConversationRow>('SELECT id, type, peer_id, group_id, lamport_clock, created_at, updated_at FROM conversations WHERE type = ? AND peer_id = ? LIMIT 1', ['direct', peerId.value]);
    return row ? mapConversation(row) : null;
  }
  async findById(id: ConversationId): Promise<Conversation | null> {
    const row = await this.db.queryOne<ConversationRow>('SELECT id, type, peer_id, group_id, lamport_clock, created_at, updated_at FROM conversations WHERE id = ?', [id.value]);
    return row ? mapConversation(row) : null;
  }
  async list(): Promise<Conversation[]> {
    const rows = await this.db.query<ConversationRow>('SELECT id, type, peer_id, group_id, lamport_clock, created_at, updated_at FROM conversations ORDER BY updated_at DESC');
    return rows.map(mapConversation);
  }
}

export class SqliteMessageRepository implements MessageRepository {
  constructor(private readonly db: SqliteDatabasePort) {}
  async save(message: Message): Promise<void> {
    const snapshot = message.snapshot;
    await this.db.execute(
      `INSERT INTO messages (id, conversation_id, sender_peer_id, recipient_peer_id, status, encrypted_payload, lamport_clock, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET status = excluded.status, encrypted_payload = excluded.encrypted_payload, updated_at = excluded.updated_at`,
      [snapshot.id.value, snapshot.conversationId.value, snapshot.fromPeerId.value, snapshot.toPeerId?.value ?? null, snapshot.status, snapshot.encryptedPayload?.value ?? null, snapshot.lamportClock.value, snapshot.createdAt.toISOString(), snapshot.updatedAt.toISOString()]
    );
  }
  async findById(messageId: string): Promise<Message | null> {
    const row = await this.db.queryOne<MessageRow>('SELECT id, conversation_id, sender_peer_id, recipient_peer_id, status, encrypted_payload, lamport_clock, created_at, updated_at FROM messages WHERE id = ?', [messageId]);
    return row ? mapMessage(row) : null;
  }
  async listByConversationId(conversationId: ConversationId): Promise<Message[]> {
    const rows = await this.db.query<MessageRow>('SELECT id, conversation_id, sender_peer_id, recipient_peer_id, status, encrypted_payload, lamport_clock, created_at, updated_at FROM messages WHERE conversation_id = ? ORDER BY lamport_clock ASC, created_at ASC', [conversationId.value]);
    return rows.map(mapMessage);
  }
}

export class SqliteOutboxRepository implements OutboxRepository {
  constructor(private readonly db: SqliteDatabasePort) {}
  async save(entry: OutboxEntry): Promise<void> {
    const snapshot = entry.snapshot;
    await this.db.execute(
      `INSERT INTO outbox (envelope_id, to_peer_id, envelope_json, status, retry_count, next_attempt_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(envelope_id) DO UPDATE SET status = excluded.status, retry_count = excluded.retry_count, next_attempt_at = excluded.next_attempt_at, updated_at = excluded.updated_at`,
      [snapshot.envelopeId, snapshot.toPeerId ?? null, snapshot.envelopeJson, snapshot.status, snapshot.retryCount, toIso(snapshot.nextAttemptAt), snapshot.createdAt.toISOString(), snapshot.updatedAt.toISOString()]
    );
  }
  async findDue(now: Date, limit: number): Promise<OutboxEntry[]> {
    const rows = await this.db.query<OutboxRow>(
      `SELECT envelope_id, to_peer_id, envelope_json, status, retry_count, next_attempt_at, created_at, updated_at
       FROM outbox
       WHERE status IN ('queued_until_reachable', 'ready_to_publish') AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
       ORDER BY created_at ASC LIMIT ?`,
      [now.toISOString(), limit]
    );
    return rows.map(mapOutbox);
  }
  async list(): Promise<OutboxEntry[]> {
    const rows = await this.db.query<OutboxRow>('SELECT envelope_id, to_peer_id, envelope_json, status, retry_count, next_attempt_at, created_at, updated_at FROM outbox ORDER BY created_at ASC');
    return rows.map(mapOutbox);
  }
}

export class SqliteInboxRepository implements InboxRepository {
  constructor(private readonly db: SqliteDatabasePort) {}
  async save(entry: InboxEntry): Promise<void> {
    const snapshot = entry.snapshot;
    await this.db.execute(
      `INSERT INTO inbox (envelope_id, from_peer_id, envelope_json, received_at, processed_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(envelope_id) DO UPDATE SET processed_at = excluded.processed_at`,
      [snapshot.envelopeId, snapshot.fromPeerId, snapshot.envelopeJson, snapshot.receivedAt.toISOString(), toIso(snapshot.processedAt)]
    );
  }
  async exists(envelopeId: string): Promise<boolean> {
    const row = await this.db.queryOne<InboxRow>('SELECT envelope_id, from_peer_id, envelope_json, received_at, processed_at FROM inbox WHERE envelope_id = ?', [envelopeId]);
    return Boolean(row ? mapInbox(row) : null);
  }
}
