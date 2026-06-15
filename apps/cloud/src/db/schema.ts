import type { Client } from '@libsql/client';

export async function initSchema(db: Client): Promise<void> {
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT    NOT NULL UNIQUE,
      password_hash TEXT    NOT NULL,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS data (
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      key        TEXT    NOT NULL,
      value      TEXT    NOT NULL DEFAULT '{}',
      updated_at TEXT    NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, key)
    );
  `);

  // Migrate old single-row settings table if it exists
  const tables = await db.execute(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='settings'`
  );
  if (tables.rows.length > 0) {
    await db.executeMultiple(`
      INSERT OR IGNORE INTO data (user_id, key, value, updated_at)
        SELECT user_id, 'settings', data, updated_at FROM settings;
      DROP TABLE settings;
    `);
  }
}
