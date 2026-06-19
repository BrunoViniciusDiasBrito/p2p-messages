# PeerComms desktop

Initial local desktop preview for the PeerComms daemon API.

## Current state

- Static app shell for identity, contacts, direct messages, integration tokens, and SSE events.
- Talks to the loopback API through a configurable base URL and bearer token.
- No build step or framework dependency yet.
- Tauri 2 + Vue migration is still pending.

## Run

```bash
pnpm --filter @peercomms/desktop dev
```

The preview serves `http://127.0.0.1:17400` by default.
