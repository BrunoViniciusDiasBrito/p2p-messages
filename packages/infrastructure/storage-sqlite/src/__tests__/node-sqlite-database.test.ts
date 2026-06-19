import { describe, expect, it } from 'vitest';
import { NodeSqliteDatabase } from '../index.js';

class FakeStatement {
  readonly runs: unknown[][] = [];

  constructor(private readonly rows: Array<Record<string, unknown>>) {}

  run(...params: unknown[]): void {
    this.runs.push(params);
  }

  all(): Array<Record<string, unknown>> {
    return this.rows;
  }

  get(): Record<string, unknown> | undefined {
    return this.rows[0];
  }
}

class FakeNodeSqliteHandle {
  readonly execs: string[] = [];
  readonly statements = new Map<string, FakeStatement>();
  closed = false;

  exec(sql: string): void {
    this.execs.push(sql);
  }

  prepare(sql: string): FakeStatement {
    const existing = this.statements.get(sql);
    if (existing) return existing;
    const statement = new FakeStatement([{ id: 'row_1', count: 2, nullable: null, big: 3n, missing: undefined }]);
    this.statements.set(sql, statement);
    return statement;
  }

  close(): void {
    this.closed = true;
  }
}

describe('NodeSqliteDatabase', () => {
  it('adapts the synchronous node:sqlite API to the async local database port', async () => {
    const handle = new FakeNodeSqliteHandle();
    const db = new NodeSqliteDatabase(handle);

    await db.execute('CREATE TABLE test(id TEXT)');
    await db.execute('INSERT INTO test (id) VALUES (?)', ['row_1']);
    const rows = await db.query('SELECT * FROM test WHERE id = ?', ['row_1']);
    const row = await db.queryOne('SELECT * FROM test WHERE id = ?', ['row_1']);
    await db.close();

    expect(handle.execs).toEqual(['CREATE TABLE test(id TEXT)']);
    expect(handle.statements.get('INSERT INTO test (id) VALUES (?)')?.runs).toEqual([['row_1']]);
    expect(rows).toEqual([{ id: 'row_1', count: 2, nullable: null, big: 3, missing: null }]);
    expect(row).toEqual(rows[0]);
    expect(handle.closed).toBe(true);
  });
});
