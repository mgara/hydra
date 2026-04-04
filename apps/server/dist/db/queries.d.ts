import type { Schedule, ScheduleInput, ExecutionLog, Alert, AlertSeverity, SystemConfig, GpioAssignment, GpioPinConfig, SetupInput } from '../types.js';
export declare function isSetupComplete(): Promise<boolean>;
export declare function getSystemConfig(): Promise<SystemConfig | null>;
export declare function getGpioAssignments(): Promise<GpioAssignment[]>;
export declare function getGpioPinConfig(): Promise<GpioPinConfig>;
export declare function executeSetup(input: SetupInput, assignments: Omit<GpioAssignment, 'id'>[]): Promise<void>;
export declare function resetSetup(): Promise<void>;
export declare function getZones(): Promise<{
    zone: number;
    name: string;
    enabled: number;
    priority: number;
    gpio_pin: number | null;
    flow_gpio_pin: number | null;
    has_flow_sensor: number;
    soil_type: string | null;
    plant_type: string | null;
    smart_enabled: number;
}[]>;
export declare function updateZone(zone: number, name: string, enabled: boolean): Promise<void>;
export declare function updateZoneProfile(zone: number, soilType: string | null, plantType: string | null, smartEnabled?: boolean): Promise<void>;
export declare function getSchedules(zone?: number): Promise<Schedule[]>;
export declare function getScheduleById(id: number): Promise<Schedule | undefined>;
export declare function getEnabledSchedules(): Promise<Schedule[]>;
export declare function createSchedule(input: ScheduleInput): Promise<number>;
export declare function updateSchedule(id: number, input: Partial<ScheduleInput>): Promise<void>;
export declare function deleteSchedule(id: number): Promise<void>;
export declare function createLog(zone: number, trigger: 'scheduled' | 'manual', scheduleId?: number | null): Promise<number>;
export declare function completeLog(id: number, status: string, durationSeconds: number, volumeGallons: number | null, notes?: string): Promise<void>;
export declare function getLogs(opts?: {
    zone?: number;
    limit?: number;
    offset?: number;
    dateFrom?: string;
    dateTo?: string;
}): Promise<{
    logs: ExecutionLog[];
    total: number;
}>;
export declare function getWeeklyVolume(): Promise<number>;
export declare function getDailyVolume(): Promise<number>;
/** Check if a schedule already has a log entry today around its start time */
export declare function hasRecentLog(scheduleId: number, startTime: string): Promise<boolean>;
/** Get recent rain skip log entries (last 24 hours) */
export declare function getRecentRainSkips(): Promise<Array<{
    zone: number;
    schedule_id: number | null;
    started_at: string;
    notes: string | null;
}>>;
export declare function createAlert(severity: AlertSeverity, title: string, message: string): Promise<number>;
export declare function getAlerts(includeDismissed?: boolean): Promise<Alert[]>;
export declare function dismissAlert(id: number): Promise<void>;
export declare function clearNonCriticalAlerts(): Promise<void>;
export declare function getSetting(key: string): Promise<string | undefined>;
export declare function setSetting(key: string, value: string): Promise<void>;
export declare function getAllSettings(): Promise<Record<string, string>>;
/**
 * Write multiple settings and read them all back in a single batch (primary round-trip).
 * Ensures read-your-writes consistency with Turso embedded replicas.
 */
export declare function setSettingsAndReadAll(updates: [key: string, value: string][]): Promise<Record<string, string>>;
export interface FlowReading {
    id: number;
    timestamp: string;
    gpm: number;
    pulse_count: number;
    zone: number | null;
    event_type: string;
}
export declare function insertFlowReading(gpm: number, pulseCount: number, zone: number | null, eventType?: string): Promise<void>;
export declare function getFlowReadings(opts?: {
    since?: string;
    zone?: number;
    limit?: number;
}): Promise<FlowReading[]>;
export declare function pruneOldFlowReadings(olderThanDays?: number): Promise<void>;
export interface FlowSettings {
    flowMonitoringEnabled: boolean;
    flowSafetyEnabled: boolean;
    flowLeakDetectDelaySeconds: number;
    flowNoFlowTimeoutSeconds: number;
    flowMaxGpm: number;
    flowExpectedGpm: number;
    flowReadingIntervalSeconds: number;
}
export declare function getFlowSettings(): Promise<FlowSettings>;
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
export declare function insertSoilReading(device: string, moisture: number, temperature: number | null, battery: number | null, linkQuality: number | null, zone: number | null): Promise<void>;
export declare function getSoilReadings(opts?: {
    device?: string;
    zone?: number;
    since?: string;
    limit?: number;
}): Promise<SoilReadingRow[]>;
export declare function getLatestSoilReadingForZone(zone: number): Promise<SoilReadingRow | null>;
export declare function getSoilDevices(): Promise<{
    device: string;
    lastSeen: string;
    zone: number | null;
}[]>;
export declare function pruneOldSoilReadings(olderThanDays?: number): Promise<void>;
//# sourceMappingURL=queries.d.ts.map