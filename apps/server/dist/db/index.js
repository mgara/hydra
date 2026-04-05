import { createClient } from '@libsql/client';
import { existsSync, unlinkSync } from 'node:fs';
import { initSchema } from './schema.js';
let client = null;
export async function initDb() {
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
    }
    catch (err) {
        // Turso unreachable or sync failed — fall back to local-only
        console.warn(`[DB] Turso sync failed, falling back to local-only:`, err.message);
        client = createClient({ url: `file:${dbPath}` });
    }
    if (!tursoUrl) {
        await client.execute('PRAGMA journal_mode = WAL');
        await client.execute('PRAGMA foreign_keys = ON');
    }
    await initSchema(client);
    if (tursoUrl) {
        console.log('[DB] Connected (libsql + Turso sync)');
    }
    else {
        console.log('[DB] Connected (libsql local-only)');
    }
}
export function getDb() {
    if (!client)
        throw new Error('Database not initialized — call initDb() first');
    return client;
}
/**
 * Write settings and read them back in a single batch sent to the primary.
 * This guarantees read-your-writes consistency in Turso embedded replica mode.
 */
export async function batchWriteThenRead(writes, readSql) {
    const stmts = [
        ...writes,
        { sql: readSql, args: [] },
    ];
    const results = await getDb().batch(stmts, 'write');
    return results[results.length - 1];
}
export function closeDb() {
    if (client) {
        client.close();
        client = null;
        console.log('[DB] Connection closed');
    }
}
//# sourceMappingURL=index.js.map