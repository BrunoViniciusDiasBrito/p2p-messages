# Clean Architecture

## Dependency rule

`domain <- application <- infrastructure/apps`.

The domain package contains no imports from SQLite, libp2p, Tauri, Vue, or crypto libraries. Use cases depend on interfaces such as repositories, key providers, id generators, and event buses. Infrastructure adapters implement these interfaces.

## Error handling

Expected business failures return `Result` values. Domain invariant violations use explicit `DomainError` codes.

## Testing

Unit tests use in-memory repositories and mock ports. Integration tests will compose real SQLite and in-memory/local P2P adapters in later phases.
