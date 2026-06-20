# PeerComms desktop

Tauri 2 + Vue local desktop client for the PeerComms daemon API.

## Current state

- Vue workspace for identity, contacts, direct messages, integration tokens, notifications, network reachability, and SSE events.
- Talks to the loopback API through a configurable base URL and bearer token.
- Vite development server plus a Tauri 2 Rust shell in `src-tauri`; bundle configuration is enabled for native packaging validation.
- The sidebar remains fixed on desktop. Large lists and event output have independent styled scrollbars, and field help is available from the information controls.
- Connecting the event stream requests local notification permission; events then appear in-app and can be surfaced by the webview runtime.

## Run

```bash
pnpm --filter @peercomms/desktop dev
pnpm --filter @peercomms/desktop tauri dev
```

The Vite preview serves `http://127.0.0.1:17400` by default.

## User guide

The complete onboarding, token, contact, messaging, and local-integration guide is available in [the user manual](../../docs/user-guide.md).
