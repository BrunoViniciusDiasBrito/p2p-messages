import { Contact, ContactRequest, ContactRequestId, PeerId } from '@peercomms/domain';
import { ContactRepository, ContactRequestRepository } from '@peercomms/application';
import { fromIso, nullableString, SqliteDatabasePort, SqliteRow, toIso } from './database.js';

interface ContactRow extends SqliteRow {
  peer_id: string;
  alias: string | null;
  status: 'accepted' | 'blocked' | 'revoked';
  trusted_since: string | null;
  updated_at: string;
}

interface ContactRequestRow extends SqliteRow {
  id: string;
  local_peer_id: string;
  remote_peer_id: string;
  status: 'pending_inbound' | 'pending_outbound' | 'accepted' | 'rejected' | 'blocked' | 'revoked';
  message: string | null;
  created_at: string;
  updated_at: string;
}

const mapContact = (row: ContactRow): Contact => {
  const alias = nullableString(row.alias);
  return Contact.rehydrate({
    peerId: PeerId.create(row.peer_id),
    ...(alias ? { alias } : {}),
    status: row.status,
    ...(row.trusted_since ? { trustedSince: fromIso(row.trusted_since) } : {}),
    updatedAt: fromIso(row.updated_at)
  });
};

const mapContactRequest = (row: ContactRequestRow): ContactRequest => {
  const message = nullableString(row.message);
  return ContactRequest.rehydrate({
    id: ContactRequestId.create(row.id),
    localPeerId: PeerId.create(row.local_peer_id),
    remotePeerId: PeerId.create(row.remote_peer_id),
    status: row.status,
    ...(message ? { message } : {}),
    createdAt: fromIso(row.created_at),
    updatedAt: fromIso(row.updated_at)
  });
};

export class SqliteContactRepository implements ContactRepository {
  constructor(private readonly db: SqliteDatabasePort) {}

  async save(contact: Contact): Promise<void> {
    const snapshot = contact.snapshot;
    await this.db.execute(
      `INSERT INTO contacts (peer_id, alias, status, trusted_since, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(peer_id) DO UPDATE SET alias = excluded.alias, status = excluded.status, trusted_since = excluded.trusted_since, updated_at = excluded.updated_at`,
      [snapshot.peerId.value, snapshot.alias ?? null, snapshot.status, toIso(snapshot.trustedSince), snapshot.updatedAt.toISOString()]
    );
  }

  async findByPeerId(peerId: PeerId): Promise<Contact | null> {
    const row = await this.db.queryOne<ContactRow>('SELECT peer_id, alias, status, trusted_since, updated_at FROM contacts WHERE peer_id = ?', [peerId.value]);
    return row ? mapContact(row) : null;
  }

  async list(): Promise<Contact[]> {
    const rows = await this.db.query<ContactRow>('SELECT peer_id, alias, status, trusted_since, updated_at FROM contacts ORDER BY updated_at DESC');
    return rows.map(mapContact);
  }
}

export class SqliteContactRequestRepository implements ContactRequestRepository {
  constructor(private readonly db: SqliteDatabasePort) {}

  async save(request: ContactRequest): Promise<void> {
    const snapshot = request.snapshot;
    await this.db.execute(
      `INSERT INTO contact_requests (id, local_peer_id, remote_peer_id, status, message, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET status = excluded.status, message = excluded.message, updated_at = excluded.updated_at`,
      [snapshot.id.value, snapshot.localPeerId.value, snapshot.remotePeerId.value, snapshot.status, snapshot.message ?? null, snapshot.createdAt.toISOString(), snapshot.updatedAt.toISOString()]
    );
  }

  async findById(id: string): Promise<ContactRequest | null> {
    const row = await this.db.queryOne<ContactRequestRow>('SELECT id, local_peer_id, remote_peer_id, status, message, created_at, updated_at FROM contact_requests WHERE id = ?', [id]);
    return row ? mapContactRequest(row) : null;
  }

  async findPendingWithPeer(peerId: PeerId): Promise<ContactRequest | null> {
    const row = await this.db.queryOne<ContactRequestRow>(
      `SELECT id, local_peer_id, remote_peer_id, status, message, created_at, updated_at
       FROM contact_requests
       WHERE remote_peer_id = ? AND status IN ('pending_inbound', 'pending_outbound')
       ORDER BY created_at DESC LIMIT 1`,
      [peerId.value]
    );
    return row ? mapContactRequest(row) : null;
  }

  async list(): Promise<ContactRequest[]> {
    const rows = await this.db.query<ContactRequestRow>('SELECT id, local_peer_id, remote_peer_id, status, message, created_at, updated_at FROM contact_requests ORDER BY created_at DESC');
    return rows.map(mapContactRequest);
  }
}
