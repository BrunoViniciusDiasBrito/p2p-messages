# PeerComms daemon

Headless/local daemon foundation for PeerComms.

Current responsibilities:

- Owns daemon lifecycle through `PeerCommsDaemon`.
- Opens Node's built-in SQLite adapter through `createSqliteDaemon`, loads package migrations, runs them before listening, and closes the database during shutdown.
- Runs optional maintenance tasks with overlap protection; `InboxReplayCompactionTask` applies the replay-metadata retention policy once at startup and then daily by default.
- Binds the local API handler through a `LoopbackServerPort` abstraction.
- Provides `NodeLoopbackServer`, a framework-free Node HTTP adapter that listens only on `127.0.0.1` when composed by the application.

After building the workspace on Node 22.5+ (or another runtime with `node:sqlite`), run:

```sh
pnpm --filter @peercomms/daemon smoke:sqlite
```

Still pending:

- Concrete crypto adapter composition.
- P2P node lifecycle.
- Wiring notification publishers and SSE event forwarding.
