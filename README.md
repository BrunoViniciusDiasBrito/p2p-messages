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

Estimated completion against the full instruction set: **30%**. See [implementation progress](docs/progress.md).

## Prioritized TODO

1. Implement audited crypto adapter and encrypted local keystore integration.
2. Implement SQLite repository adapters for identity, contacts, conversations, messages, outbox, and inbox.
3. Add audited crypto adapter and encrypted local keystore integration tests.
4. Add in-memory two-node transport integration tests for direct messages.
5. Add libp2p adapter with mDNS local discovery and optional DHT/bootstrap configuration.
6. Implement local REST/SSE API on `127.0.0.1` with token scopes and rate limits.
7. Expand SDK from documented OpenAPI contracts.
8. Add group context with MLS/OpenMLS adapter boundary.
9. Scaffold Tauri/Vue desktop UI after daemon APIs stabilize.
