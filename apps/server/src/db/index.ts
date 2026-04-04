import { createClient, type Client } from '@libsql/client';
import { initSchema } from './schema.js';

let client: Client | null = null;

export async function initDb(): Promise<void> {
  client = createClient({
    url: 'file:./data/hydra.db',
    syncUrl: process.env.TURSO_URL,
    authToken: process.env.TURSO_TOKEN,
    syncInterval: 60,
  });

  // PRAGMAs not supported in Turso embedded replica mode
  if (!process.env.TURSO_URL) {
    await client.execute('PRAGMA journal_mode = WAL');
    await client.execute('PRAGMA foreign_keys = ON');
  }
  await initSchema(client);

  // In embedded replica mode, sync the local file with the primary
  // so that reads reflect the schema/seed writes we just sent to the primary
  if (process.env.TURSO_URL) {
    await client.sync();
    console.log('[DB] Connected (libsql + Turso sync) — local replica synced');
  } else {
    console.log('[DB] Connected (libsql local-only)');
  }
}

export function getDb(): Client {
  if (!client) throw new Error('Database not initialized — call initDb() first');
  return client;
}

/**
 * Write settings and read them back in a single batch sent to the primary.
 * This guarantees read-your-writes consistency in Turso embedded replica mode.
 */
export async function batchWriteThenRead(
  writes: { sql: string; args: (string | number | null)[] }[],
  readSql: string,
): Promise<import('@libsql/client').ResultSet> {
  const stmts = [
    ...writes,
    { sql: readSql, args: [] as (string | number | null)[] },
  ];
  const results = await getDb().batch(stmts, 'write');
  return results[results.length - 1];
}

export function closeDb(): void {
  if (client) {
    client.close();
    client = null;
    console.log('[DB] Connection closed');
  }
}
