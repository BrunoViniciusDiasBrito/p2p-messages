# DDD Context Map

## Identity

Owns local identity, public profile, device id, peer id, fingerprint, and secure backup boundaries. Private key material is represented only by references.

## Trust & Contacts

Owns contact requests, approvals, rejections, blocking, trust state, and rules that prevent normal direct messages before acceptance.

## Messaging

Owns conversations, direct messages, outbox/inbox, delivery status, causal ordering, deduplication, and replay-resistant message identifiers.

## Groups

Owns group membership, invitations, key epochs, and MLS/OpenMLS adapter boundary. Group crypto must not be homegrown.

## P2P Network

Owns peer discovery, reachability, connection status, routing, retry, and store-and-forward transport envelope exchange.

## Notifications

Owns local notifications and local event fanout for UI/API integrations.

## Integration

Owns external application registration, API tokens, permissions, local webhooks, and SDK-facing events.
