# Crypto Decisions

1. Do not invent cryptography.
2. Identity is public-key based; public IDs are derived from public keys.
3. Private key material is never modeled as raw bytes in the domain; only `PrivateKeyReference` crosses domain/application boundaries.
4. Direct-message encryption will be implemented through a crypto port backed by audited open-source libraries such as libsodium or noble crypto.
5. Group messaging will use an MLS/OpenMLS adapter boundary; temporary group tests may mock crypto but production group crypto must use a reviewed MLS implementation.
6. Envelopes are signed and include nonces, timestamps, IDs, and optional expiry to support replay protection.
7. Logs must be sanitized and must not include private keys, tokens, plaintext messages, or recovery secrets.

8. Group membership use cases depend on a `GroupCryptoPort` for welcome creation, welcome acceptance, and epoch rotation; the current code deliberately does not implement group encryption itself.

## Direct-message adapter status

The infrastructure layer now includes an initial WebCrypto adapter for local/test direct-message composition. It uses platform WebCrypto primitives rather than custom algorithms: ECDSA P-256 with SHA-256 for envelope signatures and AES-GCM for direct-message payload encryption. The current key store is intentionally in-memory; production composition still requires encrypted local persistence, key backup/rotation UX, and a review against the final libsodium/libp2p Noise/OpenMLS adapter choices.


## Encrypted local vault status

The crypto infrastructure package now includes an encrypted JSON vault for sensitive adapter material. It uses WebCrypto PBKDF2-SHA256 for passphrase-based key derivation and AES-256-GCM for authenticated encryption, with storage hidden behind a port so the daemon can later use SQLite, filesystem, or OS keystore-backed persistence. This is not a substitute for platform secure enclaves/OS keychains; production composition must bind the vault to an OS keystore or equivalent local secret manager where available.


The storage-sqlite package now includes an adapter for persisting encrypted vault records in SQLite. It stores only metadata, salt, nonce, and ciphertext; plaintext key material must never be written to SQLite columns.
