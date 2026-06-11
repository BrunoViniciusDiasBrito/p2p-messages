# PeerComms Initial Threat Model

## Assets

- Identity private keys and device keys.
- Contact graph and trust state.
- Message plaintext before encryption and after decryption.
- Local database contents and outbox/inbox envelopes.
- API tokens for local integrations.

## Threats and mitigations

| Threat | Risk | Mitigation |
| --- | --- | --- |
| MITM | Attacker intercepts traffic and alters envelopes. | Use libp2p secure transports plus payload signatures and peer IDs derived from public keys. |
| Identity spoofing | Malicious peer claims another ID. | Validate public identity cryptographically and verify envelope signatures. |
| Replay attack | Old envelope is resent. | Enforce nonce, timestamp, message id, expiry, and inbox deduplication. |
| Malicious peer | Peer sends malformed or abusive payloads. | Zod validation, contact policy, rate limits, blocking, no content execution. |
| Contact-request spam | User is flooded with requests. | Separate request inbox, local rate limits, blocking, future proof-of-work/trust heuristics. |
| Metadata leakage | Routing reveals peer graph/timing. | Minimize envelope routing metadata and document relay/NAT observer limitations. |
| Device theft | Local DB and keys are exposed. | Store private keys in OS keystore/encrypted store; encrypt sensitive local data where possible. |
| Key loss | User loses identity. | Recovery bundles encrypted with audited KDF/encryption; no plaintext export. |
| Local integration abuse | Third-party app misuses local API. | Per-app tokens, scopes, revocation, loopback binding, rate limits, audit events. |
| Untrusted network traffic | LAN/Internet attackers inject traffic. | Authenticated transport, signed envelopes, strict schemas. |
| NAT/relay observing metadata | Optional relay sees timing and addressing. | Relays are optional and decentralized; payloads remain E2E encrypted; document metadata limits. |

## Non-goals in the first delivery

- No custom cryptographic primitive.
- No global availability guarantee without reachable peers or optional relays.
- No remote OS push without external push infrastructure.


## Local integration controls added

Local integrations are modeled with per-app tokens, explicit permission scopes, token hashing, revocation, loopback-only webhook URLs, and a rate-limit port. Controllers must never log raw tokens and should return raw tokens only once at creation time.


## Local API adapter controls

The local API adapter rejects non-loopback hosts before routing, extracts bearer tokens only for protected integration operations, and keeps request handling in infrastructure while delegating business rules to application use cases. The daemon composition must still avoid logging bearer tokens or plaintext message bodies.
