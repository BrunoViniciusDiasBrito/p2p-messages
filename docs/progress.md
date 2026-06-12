# Implementation Progress

Estimated completion against the full instruction set: **80%**.

## Completed

- Monorepo foundation and package boundaries.
- Initial Identity and Trust & Contacts domain/application slices.
- Versioned transport envelope schemas.
- Initial SQLite schema including outbox/inbox tables.
- Initial threat model, ADRs, limitations, architecture, protocol, integration, and SDK docs.
- Initial Messaging domain/application slice for direct text messages with accepted-contact enforcement, encryption/signing ports, inbox deduplication model, outbox queueing, and retry backoff use case.
- Initial Groups domain/application slice for group creation, accepted-contact invitations, invitation acceptance/rejection, member removal, key epoch rotation, and MLS/OpenMLS adapter ports.
- Initial SQLite repository adapters for identity, contacts, contact requests, conversations, messages, outbox, inbox, groups, and group invitations using a replaceable local database port.
- Initial Integration domain/application slice for external apps, hash-only API tokens, permission scopes, local rate-limit port, loopback webhook subscriptions, and OpenAPI local API contract.
- Framework-free local HTTP/SSE API adapter that routes loopback requests to use cases and rejects non-loopback hosts.
- Expanded TypeScript SDK methods for identity, contacts, conversations, direct messages, groups, webhooks, and SSE events.
- Initial Notifications domain/application/storage slice for local in-app/API/SSE/webhook notifications, mark-read flow, and event subscriptions.
- Initial daemon/headless lifecycle foundation with migration runner support and framework-free Node loopback HTTP server adapter.
- Initial P2P Network domain/application slice with required peer node use cases and an in-memory local two-node transport adapter for tests.

## Remaining major work

- Concrete audited crypto adapter and local encrypted key store.
- Concrete open-source SQLite driver adapter for the daemon database port.
- libp2p adapter with mDNS, DHT/Kademlia, secure transport, optional relay support, and real local node integration tests.
- Concrete group-message encryption and MLS/OpenMLS adapter implementation.
- Full daemon composition that wires concrete repositories, crypto, notifications, and P2P lifecycle together.
- SDK generation pipeline from OpenAPI; handwritten SDK is currently expanded but not generated.
- Tauri 2 + Vue desktop UI.
- Notifications UI/desktop adapter wiring, E2E tests, and hardening pass.
