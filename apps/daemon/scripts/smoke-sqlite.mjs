import { NodeSqliteDatabase, SqliteMigrationRunner, loadSqliteMigrations } from '@peercomms/storage-sqlite';

const database = await NodeSqliteDatabase.open(':memory:');

try {
  const migrations = await loadSqliteMigrations();
  const result = await new SqliteMigrationRunner(database, migrations).run();
  const tables = await database.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('identities', 'inbox', 'encrypted_vault_records') ORDER BY name");
  const requiredTables = ['encrypted_vault_records', 'identities', 'inbox'];
  const foundTables = tables.map((table) => table.name);

  if (JSON.stringify(foundTables) !== JSON.stringify(requiredTables)) {
    throw new Error(`SQLite smoke check did not create the expected tables: ${foundTables.join(', ')}`);
  }

  console.log(`SQLite smoke check passed (${result.applied.length} migration${result.applied.length === 1 ? '' : 's'} applied).`);
} finally {
  await database.close();
}
