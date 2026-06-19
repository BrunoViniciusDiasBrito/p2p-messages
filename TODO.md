# PeerComms prioritized technical TODO

Progress is tracked by the phase checklist below; an aggregate percentage would be misleading while major runtime work remains.

## Phase 3

- Wire the concrete SQLite driver adapter into the daemon composition root and add a smoke command.
- Compose the encrypted vault/key store with an OS keystore/passphrase unlock flow in the daemon for private key references and shared secrets.
- Add OpenAPI generation verification.
- Schedule the persistent replay metadata compaction/retention policy in the daemon maintenance loop.

## Phase 4

- Add libp2p adapter with secure transport, mDNS, optional DHT/bootstrap, optional relays, and protocol streams.
- Expand network status and peer reachability projections from real runtime events.

## Phase 5+

- Implement concrete MLS/OpenMLS adapter and encrypted group-message send/receive flow.
- Add local REST/SSE API with scoped tokens and rate limits.
- Generate SDK from `packages/protocol/openapi/local-api.v1.yaml` and keep contract tests aligned with the local API adapter.
- Migrate the static desktop preview to Tauri 2 + Vue and wire notification publishers to daemon/UI adapters.
