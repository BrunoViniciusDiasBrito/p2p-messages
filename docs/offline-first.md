# Offline-first Model

Local state is the source of truth. The outbox stores envelopes until a peer is reachable; the inbox stores received envelopes and deduplicates by envelope id.

Reachability states:

- `local only`
- `peer reachable`
- `peer unreachable`
- `queued until reachable`

No global delivery is promised without connectivity, local proximity, or optional decentralized/community relay nodes.
