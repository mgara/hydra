import { createClient, type Client } from '@libsql/client';
import { initSchema } from './schema.js';

let client: Client | null = null;

export async function initDb(): Promise<void> {
  client = createClient({ url: 'file:./data/hydra.db' });
  await client.execute('PRAGMA journal_mode = WAL');
  await client.execute('PRAGMA foreign_keys = ON');
  await initSchema(client);
  console.log('[DB] Connected (libsql local)');
}

export function getDb(): Client {
  if (!client) throw new Error('Database not initialized — call initDb() first');
  return client;
}

/**
 * Write and read back in a single local batch.
 */
export async function batchWriteThenRead(
  writes: { sql: string; args: (string | number | null)[] }[],
  readSql: string,
): Promise<import('@libsql/client').ResultSet> {
  const stmts = [
    ...writes,
    { sql: readSql, args: [] as (string | number | null)[] },
  ];
  const results = await getDb().batch(stmts);
  return results[results.length - 1];
}

export function closeDb(): void {
  if (client) {
    client.close();
    client = null;
    console.log('[DB] Connection closed');
  }
}
