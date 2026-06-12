# ADR 0002: Optional decentralized P2P network infrastructure

## Status

Accepted for initial implementation.

## Context

PeerComms must be decentralized, offline-first, secure, and incrementally testable without a mandatory central backend.

## Decision

Use a TypeScript pnpm monorepo with DDD/Clean Architecture boundaries, domain/application packages isolated from infrastructure, and replaceable adapters for storage, crypto, networking, notifications, and local integration.

## Consequences

- Domain remains portable and testable.
- Use cases can run with in-memory adapters before SQLite/libp2p are complete.
- Some capabilities, such as remote push and global delivery for offline peers, remain explicitly limited without optional infrastructure.

## Update: in-memory first transport

Before composing libp2p, the project now includes an in-memory P2P adapter that exercises the same application P2P ports. This allows deterministic local tests for discovery, connection, envelope publication, and unreachable peers without introducing a central server or coupling use cases to libp2p APIs.
