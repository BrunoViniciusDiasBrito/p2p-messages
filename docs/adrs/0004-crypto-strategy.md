# ADR 0004: Audited crypto through ports

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
