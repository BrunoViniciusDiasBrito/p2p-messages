import { SqliteMigration, SqliteMigrationRunner } from './migrations.js';
import { loadSqliteMigrations } from './migration-loader.js';
import { NodeSqliteDatabase, NodeSqliteDatabaseOptions } from './node-sqlite-database.js';

export interface NodeSqlitePersistenceOptions extends NodeSqliteDatabaseOptions {
  readonly migrations?: readonly SqliteMigration[];
}

export interface NodeSqlitePersistence {
  readonly database: NodeSqliteDatabase;
  readonly migrations: SqliteMigrationRunner;
  close(): Promise<void>;
}

export async function openNodeSqlitePersistence(options: NodeSqlitePersistenceOptions): Promise<NodeSqlitePersistence> {
  const database = await NodeSqliteDatabase.open(options);
  try {
    const migrations = options.migrations ?? await loadSqliteMigrations();
    return {
      database,
      migrations: new SqliteMigrationRunner(database, migrations),
      close: () => database.close()
    };
  } catch (error) {
    await database.close();
    throw error;
  }
}
