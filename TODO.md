# PeerComms prioritized technical TODO

Progress is tracked by the phase checklist below; an aggregate percentage would be misleading while major runtime work remains.

## Phase 3

- Add OS-keystore/passphrase onboarding around the daemon's persistent encrypted vault. Encrypted backup, restore, in-memory lock, and passphrase rotation are implemented.

## Phase 4

- Complete the libp2p socket-level integration test. The daemon now owns the runtime, outbox delivery retry, inbound envelope processor, and persistent reachability projection.

## Phase 5+

- Implement concrete MLS/OpenMLS adapter and encrypted group-message send/receive flow.
- Complete local API provisioning hardening, including authenticated read scopes and durable webhook delivery retry.
- Run the Tauri native build/package path and add end-to-end coverage.
