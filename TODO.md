# PeerComms prioritized technical TODO

Current estimated completion: **99%**.

## Phase 3

- Implement a concrete SQLite driver adapter such as better-sqlite3/sql.js/libsql-compatible local mode for the daemon database port.
- Compose the encrypted vault with an OS keystore/passphrase unlock flow in the daemon for private key references and shared secrets.
- Add OpenAPI generation verification and daemon composition smoke command.
- Add persistent replay metadata compaction/retention policy for inbox history.

## Phase 4

- Add libp2p adapter with secure transport, mDNS, optional DHT/bootstrap, optional relays, and protocol streams.
- Expand network status and peer reachability projections from real runtime events.

## Phase 5+

- Implement concrete MLS/OpenMLS adapter and encrypted group-message send/receive flow.
- Add local REST/SSE API with scoped tokens and rate limits.
- Generate SDK from `packages/protocol/openapi/local-api.v1.yaml` and keep contract tests aligned with the local API adapter.
- Wire notification publishers to daemon/UI adapters and scaffold Tauri/Vue desktop app.
