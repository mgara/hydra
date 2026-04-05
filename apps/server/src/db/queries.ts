import { getDb, batchWriteThenRead } from './index.js';
import type { Schedule, ScheduleInput, ExecutionLog, Alert, AlertSeverity, SystemConfig, GpioAssignment, GpioPinConfig, SetupInput, StartMode } from '../types.js';
import type { Row } from '@libsql/client';

// ── System Config Queries ───────────────────────────────

export async function isSetupComplete(): Promise<boolean> {
  try {
    const result = await getDb().execute(
      'SELECT setup_complete FROM system_config WHERE id = 1'
    );
    return result.rows.length > 0 && Number(result.rows[0].setup_complete) === 1;
  } catch {
    return false;
  }
}

export async function getSystemConfig(): Promise<SystemConfig | null> {
  try {
    const result = await getDb().execute('SELECT * FROM system_config WHERE id = 1');
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      zoneCount: Number(row.zone_count),
      hasRainSensor: !!row.has_rain_sensor,
      hasScreen: !!row.has_screen,
      moistureSensorCount: Number(row.moisture_sensor_count),
      perZoneFlow: !!row.per_zone_flow,
      setupComplete: !!row.setup_complete,
    };
  } catch {
    return null;
  }
}

export async function getGpioAssignments(): Promise<GpioAssignment[]> {
  const result = await getDb().execute('SELECT * FROM gpio_assignments ORDER BY id');
  return result.rows.map(row => ({
    id: Number(row.id),
    role: row.role as GpioAssignment['role'],
    pin: Number(row.pin),
    zone: row.zone != null ? Number(row.zone) : null,
    label: row.label as string,
  }));
}

export async function getGpioPinConfig(): Promise<GpioPinConfig> {
  const assignments = await getGpioAssignments();

  let masterValvePin = 0;
  let masterFlowPin = 0;
  let rainSensorPin: number | null = null;
  const zoneValvePins: Record<number, number> = {};
  const zoneFlowPins: Record<number, number> = {};

  for (const a of assignments) {
    switch (a.role) {
      case 'master_valve': masterValvePin = a.pin; break;
      case 'master_flow': masterFlowPin = a.pin; break;
      case 'rain_sensor': rainSensorPin = a.pin; break;
      case 'zone_valve': if (a.zone != null) zoneValvePins[a.zone] = a.pin; break;
      case 'zone_flow': if (a.zone != null) zoneFlowPins[a.zone] = a.pin; break;
    }
  }

  return { masterValvePin, masterFlowPin, rainSensorPin, zoneValvePins, zoneFlowPins };
}

export async function executeSetup(
  input: SetupInput,
  assignments: Omit<GpioAssignment, 'id'>[],
): Promise<void> {
  const db = getDb();

  // Insert system config
  await db.execute({
    sql: `INSERT INTO system_config (id, zone_count, has_rain_sensor, has_screen, moisture_sensor_count, per_zone_flow, setup_complete)
          VALUES (1, ?, ?, ?, ?, ?, 1)`,
    args: [
      input.zoneCount,
      input.hasRainSensor ? 1 : 0,
      input.hasScreen ? 1 : 0,
      input.moistureSensorCount ?? 0,
      input.perZoneFlow ? 1 : 0,
    ],
  });

  // Insert GPIO assignments
  await db.batch(
    assignments.map(a => ({
      sql: 'INSERT INTO gpio_assignments (role, pin, zone, label) VALUES (?, ?, ?, ?)',
      args: [a.role, a.pin, a.zone, a.label],
    })),
  );

  // Create zone rows
  const zoneInserts: { sql: string; args: (string | number | null)[] }[] = [];
  for (let z = 1; z <= input.zoneCount; z++) {
    const valveAssignment = assignments.find(a => a.role === 'zone_valve' && a.zone === z);
    const flowAssignment = assignments.find(a => a.role === 'zone_flow' && a.zone === z);
    zoneInserts.push({
      sql: 'INSERT INTO zones (zone, name, gpio_pin, flow_gpio_pin, has_flow_sensor) VALUES (?, ?, ?, ?, ?)',
      args: [z, `Zone ${z}`, valveAssignment?.pin ?? null, flowAssignment?.pin ?? null, flowAssignment ? 1 : 0],
    });
  }
  await db.batch(zoneInserts, 'write');

  // Seed default settings
  const defaults: [string, string][] = [
    ['controller_name', 'HYDRA-PRIMARY'],
    ['master_valve_enabled', 'true'],
    ['default_run_minutes', '15'],
    ['rain_skip_threshold', '40'],
    ['weather_lat', '34.0522'],
    ['weather_lon', '-118.2437'],
    ['admin_pin', '1234'],
    ['flow_monitoring_enabled', 'true'],
    ['flow_safety_enabled', 'true'],
    ['flow_leak_detect_delay_seconds', '30'],
    ['flow_no_flow_timeout_seconds', '60'],
    ['flow_max_gpm', '15'],
    ['flow_expected_gpm', '5'],
    ['flow_reading_interval_seconds', '5'],
  ];
  await db.batch(
    defaults.map(([key, value]) => ({
      sql: 'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)',
      args: [key, value],
    })),
  );

  console.log(`[DB] Setup complete — ${input.zoneCount} zones configured`);
}

export async function resetSetup(): Promise<void> {
  const db = getDb();
  // Delete in dependency order (children before parents)
  await db.executeMultiple(`
    PRAGMA foreign_keys = OFF;
    DELETE FROM execution_logs;
    DELETE FROM schedules;
    DELETE FROM zones;
    DELETE FROM gpio_assignments;
    DELETE FROM system_config;
    PRAGMA foreign_keys = ON;
  `);
  console.log('[DB] Setup reset — ready for reconfiguration');
}

// ── Zone Queries ────────────────────────────────────────

export async function getZones() {
  const result = await getDb().execute('SELECT * FROM zones ORDER BY zone');
  return result.rows as unknown as Array<{
    zone: number; name: string; enabled: number; priority: number;
    gpio_pin: number | null; flow_gpio_pin: number | null; has_flow_sensor: number;
    soil_type: string | null; plant_type: string | null; smart_enabled: number;
  }>;
}

export async function updateZone(zone: number, name: string, enabled: boolean) {
  await getDb().execute({
    sql: `UPDATE zones SET name = ?, enabled = ?, updated_at = datetime('now') WHERE zone = ?`,
    args: [name, enabled ? 1 : 0, zone],
  });
}

export async function updateZoneProfile(zone: number, soilType: string | null, plantType: string | null, smartEnabled?: boolean) {
  if (smartEnabled !== undefined) {
    await getDb().execute({
      sql: `UPDATE zones SET soil_type = ?, plant_type = ?, smart_enabled = ?, updated_at = datetime('now') WHERE zone = ?`,
      args: [soilType, plantType, smartEnabled ? 1 : 0, zone],
    });
  } else {
    await getDb().execute({
      sql: `UPDATE zones SET soil_type = ?, plant_type = ?, updated_at = datetime('now') WHERE zone = ?`,
      args: [soilType, plantType, zone],
    });
  }
}

// ── Schedule Queries ────────────────────────────────────

export async function getSchedules(zone?: number): Promise<Schedule[]> {
  if (zone) {
    const result = await getDb().execute({
      sql: 'SELECT * FROM schedules WHERE zone = ? ORDER BY start_time',
      args: [zone],
    });
    return rowsToSchedules(result.rows);
  }
  const result = await getDb().execute('SELECT * FROM schedules ORDER BY zone, start_time');
  return rowsToSchedules(result.rows);
}

export async function getScheduleById(id: number): Promise<Schedule | undefined> {
  const result = await getDb().execute({
    sql: 'SELECT * FROM schedules WHERE id = ?',
    args: [id],
  });
  return result.rows[0] ? rowToSchedule(result.rows[0]) : undefined;
}

export async function getEnabledSchedules(): Promise<Schedule[]> {
  const result = await getDb().execute(
    'SELECT * FROM schedules WHERE enabled = 1 ORDER BY start_time'
  );
  return rowsToSchedules(result.rows);
}

export async function createSchedule(input: ScheduleInput): Promise<number> {
  const result = await getDb().execute({
    sql: `INSERT INTO schedules (zone, name, start_time, start_mode, start_offset, duration_minutes, days, enabled, rain_skip, priority, smart)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      input.zone,
      input.name,
      input.startTime,
      input.startMode ?? 'fixed',
      input.startOffset ?? 0,
      input.durationMinutes,
      input.days,
      input.enabled !== false ? 1 : 0,
      input.rainSkip !== false ? 1 : 0,
      input.priority ? 1 : 0,
      input.smart ? 1 : 0,
    ],
  });
  return Number(result.lastInsertRowid);
}

export async function updateSchedule(id: number, input: Partial<ScheduleInput>) {
  const fields: string[] = [];
  const values: (string | number)[] = [];

  if (input.name !== undefined) { fields.push('name = ?'); values.push(input.name); }
  if (input.startTime !== undefined) { fields.push('start_time = ?'); values.push(input.startTime); }
  if (input.startMode !== undefined) { fields.push('start_mode = ?'); values.push(input.startMode); }
  if (input.startOffset !== undefined) { fields.push('start_offset = ?'); values.push(input.startOffset); }
  if (input.durationMinutes !== undefined) { fields.push('duration_minutes = ?'); values.push(input.durationMinutes); }
  if (input.days !== undefined) { fields.push('days = ?'); values.push(input.days); }
  if (input.enabled !== undefined) { fields.push('enabled = ?'); values.push(input.enabled ? 1 : 0); }
  if (input.rainSkip !== undefined) { fields.push('rain_skip = ?'); values.push(input.rainSkip ? 1 : 0); }
  if (input.priority !== undefined) { fields.push('priority = ?'); values.push(input.priority ? 1 : 0); }
  if (input.smart !== undefined) { fields.push('smart = ?'); values.push(input.smart ? 1 : 0); }

  if (fields.length === 0) return;

  fields.push("updated_at = datetime('now')");
  values.push(id);

  await getDb().execute({
    sql: `UPDATE schedules SET ${fields.join(', ')} WHERE id = ?`,
    args: values,
  });
}

export async function deleteSchedule(id: number) {
  const db = getDb();
  // Detach logs from this schedule (keep the log history, just remove the FK reference)
  await db.execute({ sql: 'UPDATE execution_logs SET schedule_id = NULL WHERE schedule_id = ?', args: [id] });
  await db.execute({ sql: 'DELETE FROM schedules WHERE id = ?', args: [id] });
}

// ── Execution Log Queries ───────────────────────────────

export async function createLog(
  zone: number,
  trigger: 'scheduled' | 'manual',
  scheduleId?: number | null,
): Promise<number> {
  const result = await getDb().execute({
    sql: `INSERT INTO execution_logs (zone, schedule_id, trigger_type, status)
          VALUES (?, ?, ?, 'completed')`,
    args: [zone, scheduleId ?? null, trigger],
  });
  return Number(result.lastInsertRowid);
}

export async function completeLog(
  id: number,
  status: string,
  durationSeconds: number,
  volumeGallons: number | null,
  notes?: string,
) {
  await getDb().execute({
    sql: `UPDATE execution_logs
          SET ended_at = datetime('now'), duration_seconds = ?, volume_gallons = ?, status = ?, notes = ?
          WHERE id = ?`,
    args: [durationSeconds, volumeGallons, status, notes ?? null, id],
  });
}

export async function getLogs(opts: {
  zone?: number;
  limit?: number;
  offset?: number;
  dateFrom?: string;
  dateTo?: string;
} = {}): Promise<{ logs: ExecutionLog[]; total: number }> {
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (opts.zone) { conditions.push('zone = ?'); params.push(opts.zone); }
  if (opts.dateFrom) { conditions.push('started_at >= ?'); params.push(opts.dateFrom); }
  if (opts.dateTo) { conditions.push('started_at <= ?'); params.push(opts.dateTo); }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = opts.limit || 50;
  const offset = opts.offset || 0;

  const totalResult = await getDb().execute({
    sql: `SELECT COUNT(*) as count FROM execution_logs ${where}`,
    args: params,
  });

  const logsResult = await getDb().execute({
    sql: `SELECT * FROM execution_logs ${where} ORDER BY started_at DESC LIMIT ? OFFSET ?`,
    args: [...params, limit, offset],
  });

  return {
    logs: logsResult.rows as unknown as ExecutionLog[],
    total: Number(totalResult.rows[0].count),
  };
}

export async function getWeeklyVolume(): Promise<number> {
  const result = await getDb().execute(`
    SELECT COALESCE(SUM(volume_gallons), 0) as total
    FROM execution_logs
    WHERE started_at >= datetime('now', '-7 days')
      AND status = 'completed'
  `);
  return Number(result.rows[0].total);
}

export async function getDailyVolume(): Promise<number> {
  const result = await getDb().execute(`
    SELECT COALESCE(SUM(volume_gallons), 0) as total
    FROM execution_logs
    WHERE started_at >= datetime('now', 'start of day')
      AND status = 'completed'
  `);
  return Number(result.rows[0].total);
}

/** Check if a schedule already has a log entry today around its start time */
export async function hasRecentLog(scheduleId: number, startTime: string): Promise<boolean> {
  const result = await getDb().execute({
    sql: `SELECT COUNT(*) as count FROM execution_logs
          WHERE schedule_id = ? AND started_at >= datetime('now', 'start of day')`,
    args: [scheduleId],
  });
  return Number(result.rows[0].count) > 0;
}

/** Get recent rain skip log entries (last 24 hours) */
export async function getRecentRainSkips(): Promise<Array<{
  zone: number; schedule_id: number | null; started_at: string; notes: string | null;
}>> {
  const result = await getDb().execute(`
    SELECT zone, schedule_id, started_at, notes
    FROM execution_logs
    WHERE status = 'rain_skip' AND started_at >= datetime('now', '-24 hours')
    ORDER BY started_at DESC
  `);
  return result.rows as unknown as Array<{
    zone: number; schedule_id: number | null; started_at: string; notes: string | null;
  }>;
}

// ── Alert Queries ───────────────────────────────────────

export async function createAlert(severity: AlertSeverity, title: string, message: string): Promise<number> {
  const result = await getDb().execute({
    sql: 'INSERT INTO alerts (severity, title, message) VALUES (?, ?, ?)',
    args: [severity, title, message],
  });
  return Number(result.lastInsertRowid);
}

export async function getAlerts(includeDismissed = false): Promise<Alert[]> {
  if (includeDismissed) {
    const result = await getDb().execute('SELECT * FROM alerts ORDER BY created_at DESC LIMIT 100');
    return result.rows as unknown as Alert[];
  }
  const result = await getDb().execute(
    'SELECT * FROM alerts WHERE dismissed = 0 ORDER BY created_at DESC LIMIT 100'
  );
  return result.rows as unknown as Alert[];
}

export async function dismissAlert(id: number) {
  await getDb().execute({ sql: 'UPDATE alerts SET dismissed = 1 WHERE id = ?', args: [id] });
}

export async function clearNonCriticalAlerts() {
  await getDb().execute("DELETE FROM alerts WHERE severity != 'critical' AND dismissed = 1");
}

// ── Settings Queries ────────────────────────────────────

export async function getSetting(key: string): Promise<string | undefined> {
  const result = await getDb().execute({
    sql: 'SELECT value FROM settings WHERE key = ?',
    args: [key],
  });
  return result.rows[0]?.value as string | undefined;
}

export async function setSetting(key: string, value: string) {
  await getDb().execute({
    sql: `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
          ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')`,
    args: [key, value, value],
  });
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const result = await getDb().execute('SELECT "key" as k, value FROM settings');
  return Object.fromEntries(result.rows.map(r => [r.k as string, r.value as string]));
}


/**
 * Write multiple settings and read them all back in a single batch.
 */
export async function setSettingsAndReadAll(
  updates: [key: string, value: string][],
): Promise<Record<string, string>> {
  const writes = updates.map(([key, value]) => ({
    sql: `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
          ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')`,
    args: [key, value, value] as (string | number | null)[],
  }));
  const result = await batchWriteThenRead(writes, 'SELECT "key" as k, value FROM settings');
  return Object.fromEntries(result.rows.map(r => [r.k as string, r.value as string]));
}

// ── Flow Reading Queries ────────────────────────────────

export interface FlowReading {
  id: number;
  timestamp: string;
  gpm: number;
  pulse_count: number;
  zone: number | null;
  event_type: string;
}

export async function insertFlowReading(
  gpm: number,
  pulseCount: number,
  zone: number | null,
  eventType: string = 'normal',
): Promise<void> {
  await getDb().execute({
    sql: `INSERT INTO flow_readings (gpm, pulse_count, zone, event_type) VALUES (?, ?, ?, ?)`,
    args: [gpm, pulseCount, zone, eventType],
  });
}

export async function getFlowReadings(opts: {
  since?: string;
  zone?: number;
  limit?: number;
} = {}): Promise<FlowReading[]> {
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (opts.since) { conditions.push('timestamp >= ?'); params.push(opts.since); }
  if (opts.zone) { conditions.push('zone = ?'); params.push(opts.zone); }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = opts.limit || 100;

  const result = await getDb().execute({
    sql: `SELECT * FROM flow_readings ${where} ORDER BY timestamp DESC LIMIT ?`,
    args: [...params, limit],
  });
  return result.rows as unknown as FlowReading[];
}

export async function pruneOldFlowReadings(olderThanDays: number = 7): Promise<void> {
  await getDb().execute({
    sql: `DELETE FROM flow_readings WHERE timestamp < datetime('now', ?)`,
    args: [`-${olderThanDays} days`],
  });
}

export interface FlowSettings {
  flowMonitoringEnabled: boolean;
  flowSafetyEnabled: boolean;
  flowLeakDetectDelaySeconds: number;
  flowNoFlowTimeoutSeconds: number;
  flowMaxGpm: number;
  flowExpectedGpm: number;
  flowReadingIntervalSeconds: number;
}

export async function getFlowSettings(): Promise<FlowSettings> {
  const all = await getAllSettings();
  return {
    flowMonitoringEnabled: all.flow_monitoring_enabled !== 'false',
    flowSafetyEnabled: all.flow_safety_enabled !== 'false',
    flowLeakDetectDelaySeconds: parseInt(all.flow_leak_detect_delay_seconds || '30', 10),
    flowNoFlowTimeoutSeconds: parseInt(all.flow_no_flow_timeout_seconds || '60', 10),
    flowMaxGpm: parseFloat(all.flow_max_gpm || '15'),
    flowExpectedGpm: parseFloat(all.flow_expected_gpm || '5'),
    flowReadingIntervalSeconds: parseInt(all.flow_reading_interval_seconds || '5', 10),
  };
}

// ── Soil Reading Queries ─────────────────────────────────

export interface SoilReadingRow {
  id: number;
  device: string;
  moisture: number;
  temperature: number | null;
  battery: number | null;
  link_quality: number | null;
  zone: number | null;
  timestamp: string;
}

export async function insertSoilReading(
  device: string,
  moisture: number,
  temperature: number | null,
  battery: number | null,
  linkQuality: number | null,
  zone: number | null,
): Promise<void> {
  await getDb().execute({
    sql: `INSERT INTO soil_readings (device, moisture, temperature, battery, link_quality, zone) VALUES (?, ?, ?, ?, ?, ?)`,
    args: [device, moisture, temperature, battery, linkQuality, zone],
  });
}

export async function getSoilReadings(opts: {
  device?: string;
  zone?: number;
  since?: string;
  limit?: number;
} = {}): Promise<SoilReadingRow[]> {
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (opts.device) { conditions.push('device = ?'); params.push(opts.device); }
  if (opts.zone) { conditions.push('zone = ?'); params.push(opts.zone); }
  if (opts.since) { conditions.push('timestamp >= ?'); params.push(opts.since); }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = opts.limit || 100;

  const result = await getDb().execute({
    sql: `SELECT * FROM soil_readings ${where} ORDER BY timestamp DESC LIMIT ?`,
    args: [...params, limit],
  });
  return result.rows as unknown as SoilReadingRow[];
}

export async function getLatestSoilReadingForZone(zone: number): Promise<SoilReadingRow | null> {
  const result = await getDb().execute({
    sql: `SELECT * FROM soil_readings WHERE zone = ? ORDER BY timestamp DESC LIMIT 1`,
    args: [zone],
  });
  return (result.rows[0] as unknown as SoilReadingRow) ?? null;
}

export async function getSoilDevices(): Promise<{ device: string; lastSeen: string; zone: number | null }[]> {
  const result = await getDb().execute(`
    SELECT device, MAX(timestamp) as lastSeen, zone
    FROM soil_readings
    GROUP BY device
    ORDER BY lastSeen DESC
  `);
  return result.rows.map(r => ({
    device: r.device as string,
    lastSeen: r.lastSeen as string,
    zone: r.zone != null ? Number(r.zone) : null,
  }));
}

export async function pruneOldSoilReadings(olderThanDays: number = 30): Promise<void> {
  await getDb().execute({
    sql: `DELETE FROM soil_readings WHERE timestamp < datetime('now', ?)`,
    args: [`-${olderThanDays} days`],
  });
}

// ── Row Mapping Helpers ─────────────────────────────────

function rowToSchedule(row: Row): Schedule {
  return {
    id: Number(row.id),
    zone: Number(row.zone),
    name: row.name as string,
    startTime: row.start_time as string,
    startMode: (row.start_mode as StartMode) ?? 'fixed',
    startOffset: Number(row.start_offset ?? 0),
    durationMinutes: Number(row.duration_minutes),
    days: row.days as string,
    enabled: !!row.enabled,
    rainSkip: !!row.rain_skip,
    priority: !!row.priority,
    smart: !!row.smart,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowsToSchedules(rows: Row[]): Schedule[] {
  return rows.map(rowToSchedule);
}
