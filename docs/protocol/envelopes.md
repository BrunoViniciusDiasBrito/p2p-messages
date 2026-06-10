# Protocol Envelopes

Protocol version `1.0` defines a minimal routing envelope validated in `packages/protocol` with Zod.

```json
{
  "protocolVersion": "1.0",
  "envelopeId": "...",
  "type": "contact_request | contact_response | direct_message | group_invite | group_message | delivery_receipt | key_rotation",
  "fromPeerId": "...",
  "toPeerId": "...",
  "conversationId": "...",
  "groupId": "...",
  "createdAt": "...",
  "expiresAt": "...",
  "nonce": "...",
  "payload": "...",
  "signature": "..."
}
```

Sensitive payloads must be encrypted. The envelope keeps only routing metadata required for decentralized delivery. Envelopes are idempotent by `envelopeId` and deduplicated in inbox/outbox storage.
