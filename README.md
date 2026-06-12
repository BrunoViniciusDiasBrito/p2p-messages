# PeerComms

PeerComms is a decentralized, offline-first, peer-to-peer communication platform designed with DDD, Clean Architecture, and ports/adapters. This repository currently contains the first incremental deliveries: monorepo foundation, initial domain model, identity/contact use cases, an offline-first direct messaging slice, protocol schemas, SQLite migration, unit tests, and security/architecture documentation.

## Proposed product shape

- No mandatory central backend.
- Public user IDs are derived from public keys and do not require phone, email, or central login.
- Local state is the source of truth; outbox/inbox support eventual delivery when peers meet again.
- Local integration is exposed through a loopback API and SDK in later phases.
- Infrastructure adapters implement application ports; domain code does not import SQLite, Tauri, libp2p, or crypto libraries.

## What works in this delivery

- Monorepo workspace for apps and packages.
- Initial `domain`, `application`, `protocol`, `infrastructure`, `sdk`, and `testing` packages.
- Local identity aggregate with public profile export and private-key-reference separation.
- Contact request rules for inbound/outbound, approval, rejection, blocking, and accepted contacts.
- Versioned Zod transport envelope schema.
- Initial SQLite migration for identity, contacts, messages, groups, outbox/inbox, notifications, integrations, and network peers.
- Initial SDK client shape for direct messages and SSE events.
- Initial direct-message domain/application slice with accepted-contact enforcement, crypto/signature ports, persistent outbox model, inbox deduplication model, and retry backoff use case.
- Initial group domain/application slice with group creation, invitations for accepted contacts, invite acceptance/rejection, member removal, key epoch rotation, and MLS/OpenMLS crypto port boundaries.
- Initial SQLite repository adapters for identity, contacts, messaging mailboxes, groups, and invitations behind a generic local database port.
- Initial local integration model for external apps, hash-only API tokens, scoped permissions, local rate-limit boundary, loopback webhook subscriptions, and an OpenAPI v1 contract.
- Framework-free local HTTP/SSE API adapter for loopback requests plus expanded TypeScript SDK coverage for the current local API surface.
- Initial local notifications model/use cases/storage for in-app, local API, SSE and webhook channels.
- Initial daemon/headless lifecycle foundation with migration runner support and framework-free Node loopback HTTP server adapter.
- Initial P2P Network context with required peer-node use cases and in-memory two-node transport for local tests.
- Direct-message outbox retry now has a peer-node publisher bridge, and inbound direct-message envelopes can be delivered through the in-memory P2P runtime into the receive-message use case.
- Initial WebCrypto crypto adapter for local identity generation, envelope signing/verification and AES-GCM direct-message encryption in tests/development composition.
- Direct-message receive hardening for duplicate replay, expired envelopes, invalid timestamps, and tampered signatures.
- Initial encrypted JSON vault adapter for sensitive local material using WebCrypto PBKDF2-SHA256 and AES-256-GCM behind a storage port.

## Connectivity honesty

PeerComms does not promise impossible delivery semantics:

| Mode | Expected behavior |
| --- | --- |
| Offline | Messages are queued locally in outbox until a route is available. |
| LAN / nearby | Peers may discover each other through local discovery such as mDNS when implemented. |
| Internet P2P | Direct connections depend on NAT/firewall conditions and decentralized discovery. |
| Relay optional | Community/bootstrap/relay nodes may improve reachability but are optional network nodes, not a proprietary backend. |

Without a central server, there is no guarantee of instant delivery to distant offline users. Remote push notifications normally require OS push infrastructure or an intermediary; this project starts with local notifications triggered by daemon/app events.

## Commands

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm build
```

## Security posture

PeerComms does not invent cryptography. Domain/application layers use ports, and concrete adapters must use audited open-source libraries such as libsodium, noble crypto, libp2p Noise/TLS, or OpenMLS. Private key material must remain in secure storage; domain entities only carry `PrivateKeyReference` values.

See:

- [Threat model](docs/security/threat-model.md)
- [Crypto decisions](docs/security/crypto-decisions.md)
- [Limitations](docs/limitations.md)

## Progress

Estimated completion against the full instruction set: **92%**. See [implementation progress](docs/progress.md).

## Prioritized TODO

1. Compose the encrypted vault with a concrete local/OS keystore and daemon storage path.
2. Implement a concrete open-source SQLite driver adapter for the daemon database port.
3. Add protocol-schema-backed delivery contract tests and broader malformed-envelope fuzz cases.
4. Add persistent replay metadata compaction/retention policy for inbox history.
5. Add libp2p adapter with mDNS local discovery, secure transport, optional DHT/bootstrap and optional relay support.
6. Wire concrete repositories, crypto, notification publishing and P2P lifecycle into the daemon composition root.
7. Add SDK generation pipeline from the OpenAPI contract and replace/verify the handwritten SDK.
8. Implement concrete MLS/OpenMLS group-message adapter and group message transport.
9. Wire notification channels into daemon/UI adapters and scaffold Tauri/Vue desktop UI after daemon APIs stabilize.
