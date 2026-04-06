// Legacy GPIO pin mapping for migration of existing 7-zone databases
const LEGACY_GPIO_MAP = {
    1: 14, 2: 15, 3: 4, 4: 17, 5: 27, 6: 22, 7: 10,
};
const LEGACY_MASTER_PIN = 9;
const LEGACY_FLOW_PIN = 8;
const LEGACY_RAIN_PIN = 11;
export async function initSchema(db) {
    // Check if we need legacy migration (old zones table with CHECK 1-7)
    const needsMigration = await detectLegacySchema(db);
    if (needsMigration) {
        await migrateLegacySchema(db);
    }
    else {
        await createFreshSchema(db);
    }
    // Migrate existing schedules table to add solar scheduling columns
    await addSolarSchedulingColumns(db);
    // Ensure soil_readings table exists (for existing databases)
    await addSoilReadingsTable(db);
    // Add soil_type and plant_type columns to zones
    await addZoneProfileColumns(db);
}
async function createFreshSchema(db) {
    await db.executeMultiple(`
    -- Zone configuration (dynamic, no hardcoded limit)
    CREATE TABLE IF NOT EXISTS zones (
      zone            INTEGER PRIMARY KEY CHECK (zone >= 1),
      name            TEXT NOT NULL,
      enabled         INTEGER NOT NULL DEFAULT 1,
      priority        INTEGER NOT NULL DEFAULT 0,
      gpio_pin        INTEGER,
      flow_gpio_pin   INTEGER,
      has_flow_sensor INTEGER NOT NULL DEFAULT 0,
      soil_type       TEXT,
      plant_type      TEXT,
      smart_enabled   INTEGER NOT NULL DEFAULT 0,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- System configuration (singleton)
    CREATE TABLE IF NOT EXISTS system_config (
      id                    INTEGER PRIMARY KEY CHECK (id = 1),
      zone_count            INTEGER NOT NULL CHECK (zone_count BETWEEN 1 AND 11),
      has_rain_sensor       INTEGER NOT NULL DEFAULT 0,
      has_screen            INTEGER NOT NULL DEFAULT 0,
      moisture_sensor_count INTEGER NOT NULL DEFAULT 0,
      per_zone_flow         INTEGER NOT NULL DEFAULT 0,
      setup_complete        INTEGER NOT NULL DEFAULT 0
    );

    -- GPIO pin assignments
    CREATE TABLE IF NOT EXISTS gpio_assignments (
      id    INTEGER PRIMARY KEY AUTOINCREMENT,
      role  TEXT NOT NULL CHECK (role IN ('master_valve','master_flow','rain_sensor','zone_valve','zone_flow')),
      pin   INTEGER NOT NULL UNIQUE,
      zone  INTEGER,
      label TEXT NOT NULL
    );

    -- Irrigation schedules
    CREATE TABLE IF NOT EXISTS schedules (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      zone              INTEGER NOT NULL REFERENCES zones(zone),
      name              TEXT NOT NULL DEFAULT '',
      start_time        TEXT NOT NULL,
      start_mode        TEXT NOT NULL DEFAULT 'fixed' CHECK (start_mode IN ('fixed','sunrise','sunset')),
      start_offset      INTEGER NOT NULL DEFAULT 0,
      duration_minutes  INTEGER NOT NULL CHECK (duration_minutes > 0 AND duration_minutes <= 120),
      days              TEXT NOT NULL,
      enabled           INTEGER NOT NULL DEFAULT 1,
      rain_skip         INTEGER NOT NULL DEFAULT 1,
      priority          INTEGER NOT NULL DEFAULT 0,
      smart             INTEGER NOT NULL DEFAULT 0,
      expires_at        TEXT DEFAULT NULL,
      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_schedules_zone ON schedules(zone);
    CREATE INDEX IF NOT EXISTS idx_schedules_enabled ON schedules(enabled);

    -- Execution logs
    CREATE TABLE IF NOT EXISTS execution_logs (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      zone              INTEGER NOT NULL REFERENCES zones(zone),
      schedule_id       INTEGER REFERENCES schedules(id),
      started_at        TEXT NOT NULL DEFAULT (datetime('now')),
      ended_at          TEXT,
      duration_seconds  INTEGER,
      volume_gallons    REAL,
      status            TEXT NOT NULL DEFAULT 'completed'
                        CHECK (status IN ('completed','rain_skip','manual_stop','leak_alarm','error')),
      trigger_type      TEXT NOT NULL DEFAULT 'manual'
                        CHECK (trigger_type IN ('scheduled','manual')),
      notes             TEXT,
      created_at        TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_logs_zone ON execution_logs(zone);
    CREATE INDEX IF NOT EXISTS idx_logs_started ON execution_logs(started_at);
    CREATE INDEX IF NOT EXISTS idx_logs_status ON execution_logs(status);

    -- System alerts
    CREATE TABLE IF NOT EXISTS alerts (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      severity    TEXT NOT NULL CHECK (severity IN ('critical','warning','info')),
      title       TEXT NOT NULL,
      message     TEXT NOT NULL,
      dismissed   INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
    CREATE INDEX IF NOT EXISTS idx_alerts_dismissed ON alerts(dismissed);

    -- System settings (key-value store)
    CREATE TABLE IF NOT EXISTS settings (
      key         TEXT PRIMARY KEY,
      value       TEXT NOT NULL,
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Flow sensor readings (time-series for monitoring)
    CREATE TABLE IF NOT EXISTS flow_readings (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp   TEXT NOT NULL DEFAULT (datetime('now')),
      gpm         REAL NOT NULL,
      pulse_count INTEGER NOT NULL,
      zone        INTEGER,
      event_type  TEXT NOT NULL DEFAULT 'normal'
                  CHECK (event_type IN ('normal','leak','no_flow','excessive','startup','shutdown'))
    );

    CREATE INDEX IF NOT EXISTS idx_flow_readings_timestamp ON flow_readings(timestamp);

    -- Soil moisture sensor readings (via MQTT / Zigbee2MQTT)
    CREATE TABLE IF NOT EXISTS soil_readings (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      device        TEXT NOT NULL,
      moisture      REAL NOT NULL,
      temperature   REAL,
      battery       REAL,
      link_quality  INTEGER,
      zone          INTEGER,
      timestamp     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_soil_readings_timestamp ON soil_readings(timestamp);
    CREATE INDEX IF NOT EXISTS idx_soil_readings_device ON soil_readings(device);
    CREATE INDEX IF NOT EXISTS idx_soil_readings_zone ON soil_readings(zone);
  `);
    // Ensure all required settings exist (INSERT OR IGNORE won't overwrite existing values)
    const defaults = [
        ['controller_name', 'HYDRA-PRIMARY'],
        ['master_valve_enabled', 'true'],
        ['default_run_minutes', '15'],
        ['rain_skip_threshold', '40'],
        ['weather_lat', '34.0522'],
        ['weather_lon', '-118.2437'],
        ['weather_location_name', 'Los Angeles, CA'],
        ['temp_unit', 'F'],
        ['admin_pin', '1234'],
        ['flow_monitoring_enabled', 'true'],
        ['flow_safety_enabled', 'true'],
        ['flow_leak_detect_delay_seconds', '30'],
        ['flow_no_flow_timeout_seconds', '60'],
        ['flow_max_gpm', '15'],
        ['flow_expected_gpm', '5'],
        ['flow_reading_interval_seconds', '5'],
        ['moisture_skip_enabled', 'false'],
        ['moisture_skip_threshold', '60'],
        ['length_unit', 'in'],
        ['heat_wave_threshold_f', '95'],
        ['heat_wave_boost_enabled', 'true'],
    ];
    await db.batch(defaults.map(([key, value]) => ({
        sql: 'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)',
        args: [key, value],
    })));
    // Clean up any corrupted rows (e.g. key='undefined' from sync issues)
    await db.execute({ sql: `DELETE FROM settings WHERE key = 'undefined'`, args: [] });
}
/** Detect if the DB has the old schema (zones table with CHECK 1-7, no system_config) */
async function detectLegacySchema(db) {
    try {
        // Check if zones table exists with old CHECK constraint
        const tableInfo = await db.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='zones'");
        if (tableInfo.rows.length === 0)
            return false; // no zones table = fresh DB
        const createSql = tableInfo.rows[0].sql;
        const hasOldCheck = createSql.includes('BETWEEN 1 AND 7');
        // Also check if system_config table is missing
        const configExists = await db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='system_config'");
        return hasOldCheck || configExists.rows.length === 0;
    }
    catch {
        return false;
    }
}
/** Migrate legacy 7-zone database to dynamic schema */
async function migrateLegacySchema(db) {
    console.log('[DB] Detected legacy schema, migrating to dynamic zone system...');
    await db.execute('PRAGMA foreign_keys = OFF');
    try {
        // 1. Recreate zones table without CHECK(1-7), adding new columns
        await db.executeMultiple(`
      ALTER TABLE zones RENAME TO zones_legacy;

      CREATE TABLE zones (
        zone            INTEGER PRIMARY KEY CHECK (zone >= 1),
        name            TEXT NOT NULL,
        enabled         INTEGER NOT NULL DEFAULT 1,
        priority        INTEGER NOT NULL DEFAULT 0,
        gpio_pin        INTEGER,
        flow_gpio_pin   INTEGER,
        has_flow_sensor INTEGER NOT NULL DEFAULT 0,
        created_at      TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
      );

      INSERT INTO zones (zone, name, enabled, priority, created_at, updated_at)
        SELECT zone, name, enabled, priority, created_at, updated_at FROM zones_legacy;

      DROP TABLE zones_legacy;
    `);
        // 2. Backfill gpio_pin column with legacy mapping
        for (const [zone, pin] of Object.entries(LEGACY_GPIO_MAP)) {
            await db.execute({
                sql: 'UPDATE zones SET gpio_pin = ? WHERE zone = ?',
                args: [pin, Number(zone)],
            });
        }
        // 3. Create system_config table
        await db.executeMultiple(`
      CREATE TABLE IF NOT EXISTS system_config (
        id                    INTEGER PRIMARY KEY CHECK (id = 1),
        zone_count            INTEGER NOT NULL CHECK (zone_count BETWEEN 1 AND 11),
        has_rain_sensor       INTEGER NOT NULL DEFAULT 0,
        has_screen            INTEGER NOT NULL DEFAULT 0,
        moisture_sensor_count INTEGER NOT NULL DEFAULT 0,
        per_zone_flow         INTEGER NOT NULL DEFAULT 0,
        setup_complete        INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS gpio_assignments (
        id    INTEGER PRIMARY KEY AUTOINCREMENT,
        role  TEXT NOT NULL CHECK (role IN ('master_valve','master_flow','rain_sensor','zone_valve','zone_flow')),
        pin   INTEGER NOT NULL UNIQUE,
        zone  INTEGER,
        label TEXT NOT NULL
      );
    `);
        // 4. Insert system_config for legacy 7-zone setup
        await db.execute({
            sql: `INSERT OR IGNORE INTO system_config (id, zone_count, has_rain_sensor, has_screen, moisture_sensor_count, per_zone_flow, setup_complete)
            VALUES (1, 7, 1, 0, 0, 0, 1)`,
            args: [],
        });
        // 5. Insert gpio_assignments for legacy pin layout
        const assignments = [
            { role: 'master_valve', pin: LEGACY_MASTER_PIN, zone: null, label: 'Master Valve' },
            { role: 'master_flow', pin: LEGACY_FLOW_PIN, zone: null, label: 'Master Flow Sensor' },
            { role: 'rain_sensor', pin: LEGACY_RAIN_PIN, zone: null, label: 'Rain Sensor' },
        ];
        for (const [zone, pin] of Object.entries(LEGACY_GPIO_MAP)) {
            assignments.push({ role: 'zone_valve', pin, zone: Number(zone), label: `Zone ${zone} Valve` });
        }
        await db.batch(assignments.map(a => ({
            sql: 'INSERT OR IGNORE INTO gpio_assignments (role, pin, zone, label) VALUES (?, ?, ?, ?)',
            args: [a.role, a.pin, a.zone, a.label],
        })), 'write');
        console.log('[DB] Legacy migration complete — 7 zones preserved with GPIO assignments');
    }
    finally {
        await db.execute('PRAGMA foreign_keys = ON');
    }
    // Ensure remaining tables exist (alerts, settings, etc.)
    await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS schedules (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      zone              INTEGER NOT NULL REFERENCES zones(zone),
      name              TEXT NOT NULL DEFAULT '',
      start_time        TEXT NOT NULL,
      start_mode        TEXT NOT NULL DEFAULT 'fixed' CHECK (start_mode IN ('fixed','sunrise','sunset')),
      start_offset      INTEGER NOT NULL DEFAULT 0,
      duration_minutes  INTEGER NOT NULL CHECK (duration_minutes > 0 AND duration_minutes <= 120),
      days              TEXT NOT NULL,
      enabled           INTEGER NOT NULL DEFAULT 1,
      rain_skip         INTEGER NOT NULL DEFAULT 1,
      priority          INTEGER NOT NULL DEFAULT 0,
      smart             INTEGER NOT NULL DEFAULT 0,
      expires_at        TEXT DEFAULT NULL,
      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_schedules_zone ON schedules(zone);
    CREATE INDEX IF NOT EXISTS idx_schedules_enabled ON schedules(enabled);

    CREATE TABLE IF NOT EXISTS execution_logs (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      zone              INTEGER NOT NULL REFERENCES zones(zone),
      schedule_id       INTEGER REFERENCES schedules(id),
      started_at        TEXT NOT NULL DEFAULT (datetime('now')),
      ended_at          TEXT,
      duration_seconds  INTEGER,
      volume_gallons    REAL,
      status            TEXT NOT NULL DEFAULT 'completed'
                        CHECK (status IN ('completed','rain_skip','manual_stop','leak_alarm','error')),
      trigger_type      TEXT NOT NULL DEFAULT 'manual'
                        CHECK (trigger_type IN ('scheduled','manual')),
      notes             TEXT,
      created_at        TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_logs_zone ON execution_logs(zone);
    CREATE INDEX IF NOT EXISTS idx_logs_started ON execution_logs(started_at);
    CREATE INDEX IF NOT EXISTS idx_logs_status ON execution_logs(status);

    CREATE TABLE IF NOT EXISTS alerts (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      severity    TEXT NOT NULL CHECK (severity IN ('critical','warning','info')),
      title       TEXT NOT NULL,
      message     TEXT NOT NULL,
      dismissed   INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
    CREATE INDEX IF NOT EXISTS idx_alerts_dismissed ON alerts(dismissed);

    CREATE TABLE IF NOT EXISTS settings (
      key         TEXT PRIMARY KEY,
      value       TEXT NOT NULL,
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    INSERT OR IGNORE INTO settings (key, value) VALUES ('admin_pin', '1234');

    CREATE TABLE IF NOT EXISTS flow_readings (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp   TEXT NOT NULL DEFAULT (datetime('now')),
      gpm         REAL NOT NULL,
      pulse_count INTEGER NOT NULL,
      zone        INTEGER,
      event_type  TEXT NOT NULL DEFAULT 'normal'
                  CHECK (event_type IN ('normal','leak','no_flow','excessive','startup','shutdown'))
    );

    CREATE INDEX IF NOT EXISTS idx_flow_readings_timestamp ON flow_readings(timestamp);

    CREATE TABLE IF NOT EXISTS soil_readings (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      device        TEXT NOT NULL,
      moisture      REAL NOT NULL,
      temperature   REAL,
      battery       REAL,
      link_quality  INTEGER,
      zone          INTEGER,
      timestamp     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_soil_readings_timestamp ON soil_readings(timestamp);
    CREATE INDEX IF NOT EXISTS idx_soil_readings_device ON soil_readings(device);
    CREATE INDEX IF NOT EXISTS idx_soil_readings_zone ON soil_readings(zone);
  `);
}
/** Add start_mode and start_offset columns to existing schedules tables (idempotent) */
async function addSolarSchedulingColumns(db) {
    try {
        const tableInfo = await db.execute("PRAGMA table_info(schedules)");
        const columns = tableInfo.rows.map(r => r.name);
        if (!columns.includes('start_mode')) {
            await db.execute("ALTER TABLE schedules ADD COLUMN start_mode TEXT NOT NULL DEFAULT 'fixed'");
            console.log('[DB] Added start_mode column to schedules');
        }
        if (!columns.includes('start_offset')) {
            await db.execute('ALTER TABLE schedules ADD COLUMN start_offset INTEGER NOT NULL DEFAULT 0');
            console.log('[DB] Added start_offset column to schedules');
        }
        if (!columns.includes('smart')) {
            await db.execute('ALTER TABLE schedules ADD COLUMN smart INTEGER NOT NULL DEFAULT 0');
            console.log('[DB] Added smart column to schedules');
        }
        if (!columns.includes('expires_at')) {
            await db.execute('ALTER TABLE schedules ADD COLUMN expires_at TEXT DEFAULT NULL');
            console.log('[DB] Added expires_at column to schedules');
        }
    }
    catch (err) {
        console.error('[DB] Solar scheduling migration error:', err);
    }
}
/** Ensure soil_readings table exists (idempotent — for existing databases) */
async function addSoilReadingsTable(db) {
    try {
        await db.executeMultiple(`
      CREATE TABLE IF NOT EXISTS soil_readings (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        device        TEXT NOT NULL,
        moisture      REAL NOT NULL,
        temperature   REAL,
        battery       REAL,
        link_quality  INTEGER,
        zone          INTEGER,
        timestamp     TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_soil_readings_timestamp ON soil_readings(timestamp);
      CREATE INDEX IF NOT EXISTS idx_soil_readings_device ON soil_readings(device);
      CREATE INDEX IF NOT EXISTS idx_soil_readings_zone ON soil_readings(zone);
    `);
    }
    catch (err) {
        console.error('[DB] Soil readings migration error:', err);
    }
}
/** Add soil_type and plant_type columns to zones table (idempotent) */
async function addZoneProfileColumns(db) {
    try {
        const tableInfo = await db.execute("PRAGMA table_info(zones)");
        const columns = tableInfo.rows.map(r => r.name);
        if (!columns.includes('soil_type')) {
            await db.execute("ALTER TABLE zones ADD COLUMN soil_type TEXT");
            console.log('[DB] Added soil_type column to zones');
        }
        if (!columns.includes('plant_type')) {
            await db.execute("ALTER TABLE zones ADD COLUMN plant_type TEXT");
            console.log('[DB] Added plant_type column to zones');
        }
        if (!columns.includes('smart_enabled')) {
            await db.execute("ALTER TABLE zones ADD COLUMN smart_enabled INTEGER NOT NULL DEFAULT 0");
            console.log('[DB] Added smart_enabled column to zones');
        }
    }
    catch (err) {
        console.error('[DB] Zone profile columns migration error:', err);
    }
}
//# sourceMappingURL=schema.js.map