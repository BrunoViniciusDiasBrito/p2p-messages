import { describe, expect, it } from 'vitest';
import { SqliteDatabasePort, SqliteMigrationRunner, splitSqlStatements } from '../index.js';

class FakeDb implements SqliteDatabasePort {
  readonly statements: string[] = [];
  private readonly applied = new Set<string>();
  async execute(sql: string, params = []): Promise<void> {
    this.statements.push(sql);
    if (sql.startsWith('INSERT INTO schema_migrations')) this.applied.add(String(params[0]));
  }
  async query(): Promise<Record<string, string | number | null>[]> { return []; }
  async queryOne(sql: string, params = []): Promise<Record<string, string | number | null> | null> {
    if (sql.includes('schema_migrations') && this.applied.has(String(params[0]))) return { id: String(params[0]) };
    return null;
  }
}

describe('SqliteMigrationRunner', () => {
  it('splits SQL statements while ignoring line comments', () => {
    expect(splitSqlStatements('-- comment\nCREATE TABLE a(id TEXT);\nCREATE TABLE b(id TEXT);')).toEqual(['CREATE TABLE a(id TEXT)', 'CREATE TABLE b(id TEXT)']);
  });

  it('applies unapplied migrations transactionally', async () => {
    const db = new FakeDb();
    const result = await new SqliteMigrationRunner(db, [{ id: '0001', sql: 'CREATE TABLE test(id TEXT);' }]).run();
    expect(result.applied).toEqual(['0001']);
    expect(db.statements).toContain('BEGIN');
    expect(db.statements).toContain('COMMIT');
  });
});
