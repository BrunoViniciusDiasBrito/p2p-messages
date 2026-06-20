import type { PeerReachabilityStatus } from '@peercomms/domain';
import type { SqliteDatabasePort, SqliteRow } from './database.js';

interface NetworkPeerRow extends SqliteRow {
  peer_id: string;
  reachability: PeerReachabilityStatus;
  last_seen_at: string | null;
  metadata_json: string | null;
}

export interface NetworkPeerProjectionRecord {
  readonly peerId: string;
  readonly reachability: PeerReachabilityStatus;
  readonly lastSeenAt?: string;
  readonly metadata?: Record<string, unknown>;
}

const mapRow = (row: NetworkPeerRow): NetworkPeerProjectionRecord => ({
  peerId: row.peer_id,
  reachability: row.reachability,
  ...(row.last_seen_at ? { lastSeenAt: row.last_seen_at } : {}),
  ...(row.metadata_json ? { metadata: JSON.parse(row.metadata_json) as Record<string, unknown> } : {})
});

/** Persistent view of transport reachability; it never stores private keys or envelopes. */
export class SqliteNetworkPeerProjection {
  constructor(private readonly db: SqliteDatabasePort) {}

  async upsert(input: NetworkPeerProjectionRecord): Promise<void> {
    await this.db.execute(
      `INSERT INTO network_peers (peer_id, reachability, last_seen_at, metadata_json)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(peer_id) DO UPDATE SET
         reachability = excluded.reachability,
         last_seen_at = excluded.last_seen_at,
         metadata_json = excluded.metadata_json`,
      [input.peerId, input.reachability, input.lastSeenAt ?? null, input.metadata ? JSON.stringify(input.metadata) : null]
    );
  }

  async list(limit = 100): Promise<readonly NetworkPeerProjectionRecord[]> {
    const rows = await this.db.query<NetworkPeerRow>(
      'SELECT peer_id, reachability, last_seen_at, metadata_json FROM network_peers ORDER BY last_seen_at DESC LIMIT ?',
      [Math.min(Math.max(limit, 1), 500)]
    );
    return rows.map(mapRow);
  }
}
