import { createClient, type Client } from '@libsql/client';
import { initSchema } from './schema.js';

/** Local-only client — all reads and writes go here instantly */
let client: Client | null = null;

/** Remote Turso client — fire-and-forget cloud backup */
let remoteClient: Client | null = null;

export async function initDb(): Promise<void> {
  const tursoUrl = process.env.TURSO_URL;
  const tursoToken = process.env.TURSO_TOKEN;
  const dbPath = './data/hydra.db';

  // Always use a local-only client for app operations (instant reads/writes)
  client = createClient({ url: `file:${dbPath}` });
  await client.execute('PRAGMA journal_mode = WAL');
  await client.execute('PRAGMA foreign_keys = ON');
  await initSchema(client);
  console.log('[DB] Connected (libsql local)');

  // If Turso is configured, create a remote client for background cloud backup
  if (tursoUrl && tursoToken) {
    try {
      remoteClient = createClient({ url: tursoUrl, authToken: tursoToken });
      // Verify connectivity
      await remoteClient.execute('SELECT 1');
      console.log('[DB] Turso cloud backup enabled');

      // Initial sync: push local schema + data to Turso
      syncToRemote().catch(err => {
        console.warn('[DB] Initial Turso sync failed:', err.message);
      });

      // Background sync every 60s
      setInterval(() => {
        syncToRemote().catch(err => {
          console.warn('[DB] Turso background sync failed:', err.message);
        });
      }, 60_000);
    } catch (err) {
      console.warn('[DB] Turso connection failed — cloud backup disabled:', (err as Error).message);
      remoteClient = null;
    }
  }
}

/**
 * Fire-and-forget: replay a write to the remote Turso client.
 * Called after every local write. Never blocks the caller.
 */
export function replicateToRemote(
  stmts: { sql: string; args: (string | number | null)[] }[],
): void {
  if (!remoteClient) return;
  remoteClient.batch(stmts, 'write').catch(err => {
    console.warn('[DB] Turso replicate failed:', err.message);
  });
}

/** Full sync: push all settings, zones, schedules, and GPIO assignments to Turso */
async function syncToRemote(): Promise<void> {
  if (!remoteClient || !client) return;

  // Ensure remote has the schema
  await initSchema(remoteClient);

  // Sync key tables
  const tables = ['settings', 'zones', 'schedules', 'gpio_assignments', 'system_config'];
  for (const table of tables) {
    try {
      const rows = await client.execute(`SELECT * FROM ${table}`);
      if (rows.rows.length === 0) continue;

      const cols = rows.columns;
      const placeholders = cols.map(() => '?').join(', ');
      const stmts = rows.rows.map(row => ({
        sql: `INSERT OR REPLACE INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`,
        args: cols.map(c => (row[c] as string | number | null) ?? null),
      }));

      await remoteClient.batch(stmts, 'write');
    } catch (err) {
      console.warn(`[DB] Turso sync table "${table}" failed:`, (err as Error).message);
    }
  }

  console.log('[DB] Turso background sync complete');
}

export function getDb(): Client {
  if (!client) throw new Error('Database not initialized — call initDb() first');
  return client;
}

/**
 * Write and read back in a single local batch.
 * Also fire-and-forget replicates writes to Turso.
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

  // Fire-and-forget cloud backup
  replicateToRemote(writes);

  return results[results.length - 1];
}

export function closeDb(): void {
  if (remoteClient) {
    remoteClient.close();
    remoteClient = null;
  }
  if (client) {
    client.close();
    client = null;
    console.log('[DB] Connection closed');
  }
}
