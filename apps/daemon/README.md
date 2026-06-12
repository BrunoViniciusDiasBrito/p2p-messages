# PeerComms daemon

Headless/local daemon foundation for PeerComms.

Current responsibilities:

- Owns daemon lifecycle through `PeerCommsDaemon`.
- Runs optional SQLite migrations before listening.
- Binds the local API handler through a `LoopbackServerPort` abstraction.
- Provides `NodeLoopbackServer`, a framework-free Node HTTP adapter that listens only on `127.0.0.1` when composed by the application.

Still pending:

- Concrete SQLite driver composition.
- Concrete crypto adapter composition.
- P2P node lifecycle.
- Wiring notification publishers and SSE event forwarding.
