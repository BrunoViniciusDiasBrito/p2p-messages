import { SqliteDatabasePort } from './database.js';

export interface SqliteMigration {
  readonly id: string;
  readonly sql: string;
}

export class SqliteMigrationRunner {
  constructor(private readonly db: SqliteDatabasePort, private readonly migrations: readonly SqliteMigration[]) {}

  async run(): Promise<{ applied: string[]; skipped: string[] }> {
    await this.db.execute('CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
    const applied: string[] = [];
    const skipped: string[] = [];
    for (const migration of this.migrations) {
      const existing = await this.db.queryOne('SELECT id FROM schema_migrations WHERE id = ?', [migration.id]);
      if (existing) {
        skipped.push(migration.id);
        continue;
      }
      await this.db.execute('BEGIN');
      try {
        for (const statement of splitSqlStatements(migration.sql)) {
          await this.db.execute(statement);
        }
        await this.db.execute('INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)', [migration.id, new Date().toISOString()]);
        await this.db.execute('COMMIT');
        applied.push(migration.id);
      } catch (error) {
        await this.db.execute('ROLLBACK');
        throw error;
      }
    }
    return { applied, skipped };
  }
}

export function splitSqlStatements(sql: string): string[] {
  const withoutLineComments = sql
    .split('\n')
    .map((line) => line.trimStart().startsWith('--') ? '' : line)
    .join('\n');
  return withoutLineComments
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}
