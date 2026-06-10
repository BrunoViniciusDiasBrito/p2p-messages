# Offline-first Model

Local state is the source of truth. The outbox stores envelopes until a peer is reachable; the inbox stores received envelopes and deduplicates by envelope id.

Reachability states:

- `local only`
- `peer reachable`
- `peer unreachable`
- `queued until reachable`

No global delivery is promised without connectivity, local proximity, or optional decentralized/community relay nodes.


## Implemented messaging slice

Direct messages are first saved locally, encrypted through an application crypto port, wrapped in a signed transport envelope, and queued in the outbox as `queued_until_reachable`. `RetryOutboxMessagesUseCase` publishes due outbox entries through a transport port and schedules exponential backoff when a peer is unreachable. Inbound envelopes are deduplicated by `envelopeId` before decryption and message persistence.
