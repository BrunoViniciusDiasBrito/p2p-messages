# PeerComms prioritized technical TODO

Progress is tracked by the phase checklist below; an aggregate percentage would be misleading while major runtime work remains.

## Phase 3

- Add OS-keystore/passphrase onboarding, backup, and key-rotation flow around the daemon's persistent encrypted vault.

## Phase 4

- Integrate the libp2p adapter into the daemon, complete its socket-level integration test, and persist network reachability projections from runtime events.

## Phase 5+

- Implement concrete MLS/OpenMLS adapter and encrypted group-message send/receive flow.
- Complete local API provisioning hardening and connect notification publishers to daemon/SSE/UI adapters.
- Generate the SDK from `packages/protocol/openapi/local-api.v1.yaml`; the handwritten SDK is verified but still source-maintained.
- Run the Tauri native build/package path and add desktop notification and end-to-end coverage.
