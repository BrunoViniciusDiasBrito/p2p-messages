import { readdir, readFile } from 'node:fs/promises';
import { SqliteMigration } from './migrations.js';

export interface SqliteMigrationLoaderOptions {
  readonly directory?: URL;
}

/**
 * Loads package-owned SQL files so a built daemon keeps using the same
 * migrations as the workspace version.
 */
export async function loadSqliteMigrations(options: SqliteMigrationLoaderOptions = {}): Promise<SqliteMigration[]> {
  const directory = options.directory ?? new URL('../migrations/', import.meta.url);
  const entries = await readdir(directory, { withFileTypes: true });
  const fileNames = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  return Promise.all(fileNames.map(async (id) => ({
    id,
    sql: await readFile(new URL(id, directory), 'utf8')
  })));
}
