import { createClient } from '@libsql/client';
import { initSchema } from './schema.js';
let client = null;
export async function initDb() {
    client = createClient({ url: 'file:./data/hydra.db' });
    await client.execute('PRAGMA journal_mode = WAL');
    await client.execute('PRAGMA foreign_keys = ON');
    await initSchema(client);
    console.log('[DB] Connected (libsql local)');
}
export function getDb() {
    if (!client)
        throw new Error('Database not initialized — call initDb() first');
    return client;
}
/**
 * Write and read back in a single local batch.
 */
export async function batchWriteThenRead(writes, readSql) {
    const stmts = [
        ...writes,
        { sql: readSql, args: [] },
    ];
    const results = await getDb().batch(stmts);
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