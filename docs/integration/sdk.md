# TypeScript SDK

```ts
import { PeerCommsClient } from '@peercomms/sdk';

const client = new PeerCommsClient({ baseUrl: 'http://127.0.0.1:PORT', token: '...' });

await client.messages.sendDirect({ fromPeerId: 'pc_local...', toPeerId: 'pc_remote...', text: 'Olá' });

client.events.on('message.received', (event) => {
  console.log(event);
});
```

The SDK is intentionally local-API oriented. It does not talk to a centralized backend.


## Expanded SDK surface

The SDK now includes helpers for integrations, identity, contacts, conversations, direct messages, groups, loopback webhooks, and SSE event subscriptions. It remains handwritten for now; a later phase should generate or verify it from `packages/protocol/openapi/local-api.v1.yaml`.

## Contract coverage

SDK tests now verify the documented local API paths, JSON request bodies, bearer-token behavior, the group message helper, and typed `PeerCommsApiError` failures. The SDK remains handwritten until the OpenAPI generation pipeline is added, but the contract tests reduce drift while the daemon API stabilizes.
