# PeerComms prioritized technical TODO

Current estimated completion: **85%**.

## Phase 3

- Implement a concrete SQLite driver adapter such as better-sqlite3/sql.js/libsql-compatible local mode for the daemon database port.
- Add crypto adapter using audited open-source libraries.
- Add signed envelope verification integration tests, replay/deduplication tests, and direct-message delivery contract tests against real protocol schemas.

## Phase 4

- Add libp2p adapter with secure transport, mDNS, optional DHT/bootstrap, optional relays, and protocol streams.
- Expand network status and peer reachability projections from real runtime events.

## Phase 5+

- Implement concrete MLS/OpenMLS adapter and encrypted group-message send/receive flow.
- Add local REST/SSE API with scoped tokens and rate limits.
- Generate/verify SDK from `packages/protocol/openapi/local-api.v1.yaml` and add contract tests against the local API adapter.
- Wire notification publishers to daemon/UI adapters and scaffold Tauri/Vue desktop app.
