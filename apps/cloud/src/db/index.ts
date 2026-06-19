import postgres, { type Sql } from 'postgres';
import { initSchema } from './schema.js';

let db: Sql;

export async function initDb(): Promise<void> {
  const url = process.env.DB_URL;
  if (!url) throw new Error('DB_URL env var is required (postgres connection string)');
  db = postgres(url, { ssl: process.env.NODE_ENV === 'production' ? 'require' : false });
  await initSchema(db);
}

export function getDb(): Sql {
  if (!db) throw new Error('DB not initialised — call initDb() first');
  return db;
}
