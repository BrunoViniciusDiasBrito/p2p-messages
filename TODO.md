# PeerComms prioritized technical TODO

Current estimated completion: **80%**.

## Phase 3

- Implement a concrete SQLite driver adapter such as better-sqlite3/sql.js/libsql-compatible local mode for the daemon database port.
- Add crypto adapter using audited open-source libraries.
- Wire direct-message send/receive flow to the in-memory P2P transport in an end-to-end two-node integration test.
- Add signed envelope verification integration tests and replay/deduplication tests.

## Phase 4

- Add libp2p adapter with secure transport, mDNS, optional DHT/bootstrap, optional relays, and protocol streams.
- Model network status and peer reachability.

## Phase 5+

- Implement concrete MLS/OpenMLS adapter and encrypted group-message send/receive flow.
- Add local REST/SSE API with scoped tokens and rate limits.
- Generate/verify SDK from `packages/protocol/openapi/local-api.v1.yaml` and add contract tests against the local API adapter.
- Wire notification publishers to daemon/UI adapters and scaffold Tauri/Vue desktop app.
