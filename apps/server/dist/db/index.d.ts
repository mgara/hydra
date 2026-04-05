import { type Client } from '@libsql/client';
export declare function initDb(): Promise<void>;
export declare function getDb(): Client;
/**
 * Write settings and read them back in a single local batch.
 * Turso sync happens in the background via syncInterval.
 */
export declare function batchWriteThenRead(writes: {
    sql: string;
    args: (string | number | null)[];
}[], readSql: string): Promise<import('@libsql/client').ResultSet>;
export declare function closeDb(): void;
//# sourceMappingURL=index.d.ts.map