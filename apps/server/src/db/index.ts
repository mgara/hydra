import { createClient, type Client } from '@libsql/client';
import { existsSync, unlinkSync } from 'node:fs';
import { initSchema } from './schema.js';

let client: Client | null = null;

export async function initDb(): Promise<void> {
  const tursoUrl = process.env.TURSO_URL;
  const tursoToken = process.env.TURSO_TOKEN;
  const dbPath = './data/hydra.db';
  const metadataPath = `${dbPath}-metadata`;

  // If switching to Turso sync but stale metadata exists, remove it so libsql can start fresh
  if (tursoUrl && existsSync(dbPath) && !existsSync(metadataPath)) {
    console.warn('[DB] Removing stale db for clean Turso sync — existing local data will be re-synced from primary');
    unlinkSync(dbPath);
  }

  try {
    client = createClient({
      url: `file:${dbPath}`,
      syncUrl: tursoUrl,
      authToken: tursoToken,
      syncInterval: 60,
    });

    if (tursoUrl) {
      await client.sync();
    }
  } catch (err) {
    // Turso unreachable or sync failed — fall back to local-only
    console.warn(`[DB] Turso sync failed, falling back to local-only:`, (err as Error).message);
    client = createClient({ url: `file:${dbPath}` });
  }

  if (!tursoUrl) {
    await client.execute('PRAGMA journal_mode = WAL');
    await client.execute('PRAGMA foreign_keys = ON');
  }
  await initSchema(client);

  if (tursoUrl) {
    console.log('[DB] Connected (libsql + Turso sync)');
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
