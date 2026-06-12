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


## SQLite persistence adapter foundation

The storage package now implements repository adapters for identities, contacts, conversations, messages, outbox, inbox, groups, and group invitations through a generic `SqliteDatabasePort`. The daemon still needs to compose this port with a concrete open-source SQLite driver and run migrations at startup.


## Local notifications

Notifications are modeled as local-first state and can be persisted in SQLite. They support in-app, local API event, local SSE, local webhook, and desktop-local channels. Remote push is still intentionally out of scope without OS push infrastructure or optional intermediaries.


## Daemon lifecycle foundation

The daemon package can run migrations before starting the loopback API server. This prepares the offline-first local database before the app begins accepting local integration requests.

## In-memory P2P test transport

The infrastructure layer now includes an in-memory P2P adapter for local two-node tests. It supports discovery, explicit connection, direct envelope delivery, and unreachable status when a target peer is not connected. This is a test/development adapter only; production networking still requires the libp2p adapter with mDNS/DHT/secure transport.
