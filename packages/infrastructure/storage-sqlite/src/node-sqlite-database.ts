import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { SqliteDatabasePort, SqliteParams, SqlitePrimitive, SqliteRow } from './database.js';

export interface NodeSqliteStatement {
  run(...params: SqlitePrimitive[]): unknown;
  all(...params: SqlitePrimitive[]): Array<Record<string, unknown>>;
  get(...params: SqlitePrimitive[]): Record<string, unknown> | undefined;
}

export interface NodeSqliteDatabaseHandle {
  exec(sql: string): void;
  prepare(sql: string): NodeSqliteStatement;
  close(): void;
}

interface NodeSqliteModule {
  readonly DatabaseSync: new (path: string) => NodeSqliteDatabaseHandle;
}

export interface NodeSqliteDatabaseOptions {
  readonly path: string;
  readonly createDirectory?: boolean;
  readonly pragmas?: readonly string[];
}

export class NodeSqliteDatabase implements SqliteDatabasePort {
  constructor(
    private readonly database: NodeSqliteDatabaseHandle,
    readonly path = ':memory:'
  ) {}

  static async open(input: string | NodeSqliteDatabaseOptions): Promise<NodeSqliteDatabase> {
    const options = typeof input === 'string' ? { path: input } : input;
    if (options.path !== ':memory:' && options.createDirectory !== false) {
      await mkdir(dirname(options.path), { recursive: true });
    }
    const sqlite = await importNodeSqlite();
    const database = new sqlite.DatabaseSync(options.path);
    database.exec('PRAGMA foreign_keys = ON');
    for (const pragma of options.pragmas ?? []) database.exec(pragma);
    return new NodeSqliteDatabase(database, options.path);
  }

  async execute(sql: string, params: SqliteParams = []): Promise<void> {
    if (params.length === 0) {
      this.database.exec(sql);
      return;
    }
    this.database.prepare(sql).run(...params);
  }

  async query<T extends SqliteRow = SqliteRow>(sql: string, params: SqliteParams = []): Promise<T[]> {
    return this.database.prepare(sql).all(...params).map((row) => normalizeRow(row) as T);
  }

  async queryOne<T extends SqliteRow = SqliteRow>(sql: string, params: SqliteParams = []): Promise<T | null> {
    const row = this.database.prepare(sql).get(...params);
    return row ? normalizeRow(row) as T : null;
  }

  async close(): Promise<void> {
    this.database.close();
  }
}

async function importNodeSqlite(): Promise<NodeSqliteModule> {
  try {
    return await import('node:sqlite') as unknown as NodeSqliteModule;
  } catch (error) {
    throw new Error('node:sqlite is not available in this runtime; use Node.js with the built-in SQLite module or provide another SqliteDatabasePort adapter.', { cause: error });
  }
}

function normalizeRow(row: Record<string, unknown>): SqliteRow {
  const normalized: SqliteRow = {};
  for (const [key, value] of Object.entries(row)) {
    normalized[key] = normalizeValue(value);
  }
  return normalized;
}

function normalizeValue(value: unknown): SqlitePrimitive {
  if (value === null || typeof value === 'string' || typeof value === 'number') return value;
  if (typeof value === 'bigint') {
    if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
      throw new Error('SQLite integer exceeds the safe JavaScript number range');
    }
    return Number(value);
  }
  if (value === undefined) return null;
  throw new Error(`Unsupported SQLite column value for local database port: ${typeof value}`);
}
