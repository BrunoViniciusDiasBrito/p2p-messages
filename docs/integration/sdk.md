# TypeScript SDK

```ts
import { PeerCommsClient } from '@peercomms/sdk';

const client = new PeerCommsClient({ baseUrl: 'http://127.0.0.1:PORT', token: '...' });

await client.messages.sendDirect({ toPeerId: 'pc_...', text: 'Olá' });

client.events.on('message.received', (event) => {
  console.log(event);
});
```

The SDK is intentionally local-API oriented. It does not talk to a centralized backend.
