# Implementation Progress

Estimated completion against the full instruction set: **30%**.

## Completed

- Monorepo foundation and package boundaries.
- Initial Identity and Trust & Contacts domain/application slices.
- Versioned transport envelope schemas.
- Initial SQLite schema including outbox/inbox tables.
- Initial threat model, ADRs, limitations, architecture, protocol, integration, and SDK docs.
- Initial Messaging domain/application slice for direct text messages with accepted-contact enforcement, encryption/signing ports, inbox deduplication model, outbox queueing, and retry backoff use case.

## Remaining major work

- Concrete audited crypto adapter and local encrypted key store.
- SQLite repository implementations.
- In-memory and libp2p local node integration tests.
- P2P discovery/transports: mDNS, DHT/Kademlia, secure transport, optional relays.
- Groups context and MLS/OpenMLS adapter.
- Local REST/OpenAPI/SSE daemon implementation with scoped tokens/rate limits.
- SDK generated from OpenAPI.
- Tauri 2 + Vue desktop UI.
- E2E tests and hardening pass.
