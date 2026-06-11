# PeerComms prioritized technical TODO

Current estimated completion: **62%**.

## Phase 3

- Compose SQLite repositories with a concrete driver such as better-sqlite3/sql.js/libsql-compatible local mode and a migration runner.
- Add crypto adapter using audited open-source libraries.
- Add direct-message in-memory two-node transport integration test.
- Add signed envelope verification integration tests and replay/deduplication tests.

## Phase 4

- Add libp2p adapter with secure transport, mDNS, optional DHT/bootstrap, and GossipSub/protocol streams.
- Model network status and peer reachability.

## Phase 5+

- Implement concrete MLS/OpenMLS adapter and encrypted group-message send/receive flow.
- Add local REST/SSE API with scoped tokens and rate limits.
- Generate/verify SDK from `packages/protocol/openapi/local-api.v1.yaml` and add contract tests against the local API adapter.
- Scaffold Tauri/Vue desktop app.
