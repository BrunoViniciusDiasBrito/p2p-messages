-- PeerComms initial local SQLite schema.
-- Private key material is intentionally not stored here in plaintext; only key references are persisted.
CREATE TABLE IF NOT EXISTS identities (
  peer_id TEXT PRIMARY KEY,
  public_key TEXT NOT NULL,
  private_key_reference TEXT NOT NULL,
  fingerprint TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  peer_id TEXT NOT NULL REFERENCES identities(peer_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  public_key TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS contacts (
  peer_id TEXT PRIMARY KEY,
  alias TEXT,
  status TEXT NOT NULL CHECK (status IN ('accepted','blocked','revoked')),
  trusted_since TEXT,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS contact_requests (
  id TEXT PRIMARY KEY,
  local_peer_id TEXT NOT NULL,
  remote_peer_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending_inbound','pending_outbound','accepted','rejected','blocked','revoked')),
  message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS conversations (id TEXT PRIMARY KEY, type TEXT NOT NULL, peer_id TEXT, group_id TEXT, lamport_clock INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, sender_peer_id TEXT NOT NULL, recipient_peer_id TEXT, status TEXT NOT NULL, encrypted_payload TEXT, lamport_clock INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS groups (id TEXT PRIMARY KEY, name TEXT NOT NULL, key_epoch INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS group_members (group_id TEXT NOT NULL, peer_id TEXT NOT NULL, role TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', joined_at TEXT NOT NULL, removed_at TEXT, PRIMARY KEY(group_id, peer_id));
CREATE TABLE IF NOT EXISTS group_invitations (id TEXT PRIMARY KEY, group_id TEXT NOT NULL, inviter_peer_id TEXT NOT NULL, invitee_peer_id TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS outbox (envelope_id TEXT PRIMARY KEY, to_peer_id TEXT, envelope_json TEXT NOT NULL, status TEXT NOT NULL, retry_count INTEGER NOT NULL DEFAULT 0, next_attempt_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS inbox (envelope_id TEXT PRIMARY KEY, from_peer_id TEXT NOT NULL, envelope_json TEXT NOT NULL, received_at TEXT NOT NULL, processed_at TEXT);
CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, type TEXT NOT NULL, title TEXT NOT NULL, body TEXT, channels TEXT, read_at TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS external_apps (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL, revoked_at TEXT);
CREATE TABLE IF NOT EXISTS api_tokens (id TEXT PRIMARY KEY, app_id TEXT NOT NULL REFERENCES external_apps(id), token_hash TEXT NOT NULL, scopes TEXT NOT NULL, created_at TEXT NOT NULL, revoked_at TEXT);
CREATE TABLE IF NOT EXISTS webhook_subscriptions (id TEXT PRIMARY KEY, app_id TEXT NOT NULL, url TEXT NOT NULL, event_types TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS network_peers (peer_id TEXT PRIMARY KEY, reachability TEXT NOT NULL, last_seen_at TEXT, metadata_json TEXT);
