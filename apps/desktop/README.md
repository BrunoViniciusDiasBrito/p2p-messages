# PeerComms desktop

Tauri 2 + Vue local desktop client for the PeerComms daemon API.

## Current state

- Vue workspace for identity, contacts, direct messages, integration tokens, and SSE events.
- Talks to the loopback API through a configurable base URL and bearer token.
- Vite development server plus a Tauri 2 Rust shell in `src-tauri`.

## Run

```bash
pnpm --filter @peercomms/desktop dev
pnpm --filter @peercomms/desktop tauri dev
```

The Vite preview serves `http://127.0.0.1:17400` by default.
