# Implementation Progress

Progress is tracked by completed slices and remaining phases; no aggregate percentage is reported while major runtime work remains.

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
- Framework-free local HTTP/SSE API adapter that routes loopback requests to use cases, rejects non-loopback hosts, and allows loopback browser origins with ports.
- Expanded TypeScript SDK methods for identity, contacts, conversations, direct messages, groups, webhooks, and SSE events.
- Initial Notifications domain/application/storage slice for local in-app/API/SSE/webhook notifications, mark-read flow, and event subscriptions.
- Initial daemon/headless lifecycle foundation with migration runner support and framework-free Node loopback HTTP server adapter.
- Initial P2P Network domain/application slice with required peer node use cases and an in-memory local two-node transport adapter for tests.
- Direct-message outbox retry can now publish through a peer-node runtime, and inbound direct-message envelopes can be routed into `ReceiveDirectMessageUseCase` for a deterministic two-node local delivery test.
- Initial WebCrypto infrastructure adapter for local identity key generation, P-256 envelope signatures, and AES-GCM direct-message encryption using an in-memory key store.
- Direct-message receive path now enforces replay/expiry protections with inbox deduplication, signature verification, timestamp validation, and processed inbox entries.
- Initial encrypted local JSON vault for sensitive adapter material using WebCrypto PBKDF2-SHA256 and AES-256-GCM behind a storage port.
- SQLite-backed encrypted vault storage adapter for persisting encrypted key/secret records without plaintext columns.
- Concrete Node built-in SQLite database adapter for the generic daemon database port, with foreign-key enforcement and explicit close support.
- Persistent WebCrypto key store adapter for encrypted local P-256 signing keys and direct-message shared secrets, with private-key references persisted separately from key material.
- Inbox replay metadata compaction use case and repository support for processed-envelope retention windows.
- SQLite daemon composition with package migration loading, graceful database shutdown, and scheduled replay-metadata compaction support.
- Protocol-schema-backed direct-message envelope contract and two-node delivery assertion against that contract.
- Broader malformed direct-message envelope contract tests for protocol version, type, peer IDs, timestamps, nonce, payload, signature, and unexpected metadata.
- SDK local API contract tests for documented URLs, bearer-token behavior, JSON request bodies, group message endpoint coverage, and typed API errors.
- OpenAPI/SDK verification command that compares documented local API operations with the SDK's actual request paths.
- Initial static desktop preview for identity, contacts, direct messages, integration tokens, and SSE events against the local API.

## Remaining major work

- Production composition for encrypted key storage with OS keystore/passphrase unlock flow, backup/rotation UX, and libsodium/libp2p/OpenMLS hardening.
- Runtime composition for encrypted key storage with an OS keystore/passphrase unlock flow, plus a packaging/fallback decision for runtimes without `node:sqlite`.
- libp2p adapter with mDNS, DHT/Kademlia, secure transport, optional relay support, and real local node integration tests.
- Concrete group-message encryption and MLS/OpenMLS adapter implementation.
- Full daemon composition that wires concrete repositories, crypto, notifications, P2P lifecycle, and direct-message delivery adapters together.
- SDK generation pipeline from OpenAPI; the handwritten SDK is contract-verified but not yet generated.
- Tauri 2 + Vue migration for the static desktop preview.
- Notifications UI/desktop adapter wiring, E2E tests, and hardening pass.
