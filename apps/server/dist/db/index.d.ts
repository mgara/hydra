import { type Client } from '@libsql/client';
export declare function initDb(): Promise<void>;
export declare function getDb(): Client;
/**
 * Write and read back in a single local batch.
 */
export declare function batchWriteThenRead(writes: {
    sql: string;
    args: (string | number | null)[];
}[], readSql: string): Promise<import('@libsql/client').ResultSet>;
export declare function closeDb(): void;
//# sourceMappingURL=index.d.ts.map