# Crypto Decisions

1. Do not invent cryptography.
2. Identity is public-key based; public IDs are derived from public keys.
3. Private key material is never modeled as raw bytes in the domain; only `PrivateKeyReference` crosses domain/application boundaries.
4. Direct-message encryption will be implemented through a crypto port backed by audited open-source libraries such as libsodium or noble crypto.
5. Group messaging will use an MLS/OpenMLS adapter boundary; temporary group tests may mock crypto but production group crypto must use a reviewed MLS implementation.
6. Envelopes are signed and include nonces, timestamps, IDs, and optional expiry to support replay protection.
7. Logs must be sanitized and must not include private keys, tokens, plaintext messages, or recovery secrets.
