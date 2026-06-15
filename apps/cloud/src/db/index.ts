import { createClient, type Client } from '@libsql/client';
import { initSchema } from './schema.js';

let client: Client;

export async function initDb(): Promise<void> {
  const url = process.env.DB_URL ?? 'file:./data/cloud.db';
  client = createClient({ url });
  await client.execute('PRAGMA journal_mode = WAL');
  await client.execute('PRAGMA foreign_keys = ON');
  await initSchema(client);
}

export function getDb(): Client {
  if (!client) throw new Error('DB not initialised — call initDb() first');
  return client;
}
