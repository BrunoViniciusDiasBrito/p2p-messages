export type SqlitePrimitive = string | number | null;
export type SqliteParams = readonly SqlitePrimitive[];
export type SqliteRow = Record<string, SqlitePrimitive>;

export interface SqliteDatabasePort {
  execute(sql: string, params?: SqliteParams): Promise<void>;
  query<T extends SqliteRow = SqliteRow>(sql: string, params?: SqliteParams): Promise<T[]>;
  queryOne<T extends SqliteRow = SqliteRow>(sql: string, params?: SqliteParams): Promise<T | null>;
}

export const toIso = (date?: Date): string | null => date ? date.toISOString() : null;
export const fromIso = (value: SqlitePrimitive): Date => new Date(String(value));
export const nullableString = (value: SqlitePrimitive): string | undefined => typeof value === 'string' ? value : undefined;
