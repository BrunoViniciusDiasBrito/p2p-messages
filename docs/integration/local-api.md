# Local Integration API

The local API will bind to `127.0.0.1` only and require per-application bearer tokens with scopes.

## Initial endpoints

- `POST /v1/integrations/apps`
- `POST /v1/integrations/tokens`
- `GET /v1/identity/public`
- `GET /v1/contacts`
- `POST /v1/contacts/requests`
- `POST /v1/contacts/requests/:id/approve`
- `POST /v1/contacts/requests/:id/reject`
- `POST /v1/contacts/:peerId/block`
- `GET /v1/conversations`
- `GET /v1/conversations/:id/messages`
- `POST /v1/messages/direct`
- `POST /v1/groups`
- `POST /v1/groups/:groupId/invitations`
- `POST /v1/groups/invitations/:id/accept`
- `POST /v1/groups/invitations/:id/reject`
- `POST /v1/groups/:groupId/messages`
- `GET /v1/events/stream`


## Implemented integration foundation

The application layer now includes use cases for registering external apps, issuing/revoking hash-only scoped API tokens, authorizing external calls, sending direct messages from external apps, and subscribing external apps to loopback-only webhooks/events. The OpenAPI draft lives at `packages/protocol/openapi/local-api.v1.yaml`. HTTP/SSE controllers are still pending and must bind only to `127.0.0.1`.


## HTTP/SSE adapter foundation

`packages/infrastructure/integration-api` now provides a framework-free `LocalApiHttpHandler` based on the Web Fetch API. It rejects non-loopback hosts, maps OpenAPI routes to application use cases, extracts bearer tokens for integration-protected operations, and exposes an SSE event hub. A daemon still needs to bind this handler to an actual `127.0.0.1` listener.
