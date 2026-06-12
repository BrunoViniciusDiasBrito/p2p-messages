# Contact Flow

1. User A imports or scans User B public ID/profile.
2. A validates the profile cryptographically.
3. A creates an outbound contact request and publishes a signed `contact_request` envelope.
4. B stores it in a separate pending inbound request inbox.
5. B accepts, rejects, or blocks.
6. Acceptance creates a trusted contact and emits a signed `contact_response` envelope.
7. Normal direct messages are allowed only after accepted trust exists.
