import { describe, expect, it } from 'vitest';
import { loadSqliteMigrations } from '../index.js';

describe('loadSqliteMigrations', () => {
  it('loads package SQL migrations in deterministic filename order', async () => {
    const migrations = await loadSqliteMigrations();

    expect(migrations.map((migration) => migration.id)).toEqual(['0001_initial.sql']);
    expect(migrations[0]?.sql).toContain('CREATE TABLE IF NOT EXISTS identities');
  });
});
