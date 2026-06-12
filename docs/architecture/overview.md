# Architecture Overview

PeerComms uses Clean Architecture, DDD, and ports/adapters. The dependency rule is inward: domain has no infrastructure imports; application depends on domain and port interfaces; infrastructure implements ports; apps compose use cases and adapters.

## Packages

- `packages/domain`: aggregates, entities, value objects, domain events, domain errors.
- `packages/application`: use cases and ports for repositories, crypto/key providers, event buses, network, and integration.
- `packages/protocol`: versioned Zod schemas and wire contracts.
- `packages/infrastructure/*`: adapters for SQLite, crypto, libp2p, notifications, and local integration API.
- `packages/sdk`: TypeScript client for local API integration.
- `packages/testing`: in-memory repositories and test fixtures.

## Apps

- `apps/daemon`: future headless process hosting local node, API, outbox retries, notifications.
- `apps/desktop`: future Tauri 2 + Vue 3 shell.
- `apps/cli`: future operational CLI.
