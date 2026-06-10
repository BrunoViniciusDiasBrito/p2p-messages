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
