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


## Direct message payload

The direct-message application slice treats `payload` as encrypted ciphertext produced by an audited crypto adapter behind a port. The plaintext body is not placed in transport envelopes. The unsigned envelope is canonicalized before signing by the crypto adapter.


## Direct-message envelope contract

`directMessageEnvelopeSchema` narrows the base transport envelope for `direct_message` traffic. It requires `toPeerId` and `conversationId`, forbids `groupId`, keeps routing metadata minimal, and is asserted by the in-memory two-node delivery test before publishing/retrying the queued envelope.


The protocol tests include malformed direct-message envelope cases for wrong protocol versions, wrong envelope types, invalid peer IDs, missing routing fields, invalid timestamps, too-short nonces/signatures, empty payloads, forbidden group metadata, and unexpected fields.
