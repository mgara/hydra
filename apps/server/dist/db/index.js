import { createClient } from '@libsql/client';
import { existsSync, unlinkSync } from 'node:fs';
import { initSchema } from './schema.js';
let client = null;
export async function initDb() {
    const tursoUrl = process.env.TURSO_URL;
    const tursoToken = process.env.TURSO_TOKEN;
    const dbPath = './data/hydra.db';
    const metadataPath = `${dbPath}-metadata`;
    if (tursoUrl) {
        try {
            // If db exists without metadata, libsql can't open in sync mode.
            // Try as-is first; if it fails, remove only the metadata-related files and retry.
            client = createClient({
                url: `file:${dbPath}`,
                syncUrl: tursoUrl,
                authToken: tursoToken,
                syncInterval: 60,
            });
            await client.sync();
        }
        catch (err) {
            const msg = err.message;
            if (msg.includes('metadata file does not')) {
                // Clean up stale WAL/SHM/metadata so libsql can re-init sync alongside existing db
                console.warn('[DB] Cleaning stale sync state — preserving database, removing WAL/SHM files');
                for (const suffix of ['-wal', '-shm', '-metadata']) {
                    const f = `${dbPath}${suffix}`;
                    if (existsSync(f))
                        unlinkSync(f);
                }
                try {
                    client = createClient({
                        url: `file:${dbPath}`,
                        syncUrl: tursoUrl,
                        authToken: tursoToken,
                        syncInterval: 60,
                    });
                    await client.sync();
                }
                catch (retryErr) {
                    console.warn(`[DB] Turso sync failed after cleanup, falling back to local-only:`, retryErr.message);
                    client = createClient({ url: `file:${dbPath}` });
                }
            }
            else {
                console.warn(`[DB] Turso sync failed, falling back to local-only:`, msg);
                client = createClient({ url: `file:${dbPath}` });
            }
        }
    }
    else {
        client = createClient({ url: `file:${dbPath}` });
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