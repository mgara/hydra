export type ZoneStatus = 'idle' | 'running' | 'scheduled';
export interface ZoneState {
    zone: number;
    name: string;
    status: ZoneStatus;
    startedAt: string | null;
    remainingSeconds: number | null;
    lastRunAt: string | null;
    flowGpm: number;
}
export type StartMode = 'fixed' | 'sunrise' | 'sunset';
export interface Schedule {
    id: number;
    zone: number;
    name: string;
    startTime: string;
    startMode: StartMode;
    startOffset: number;
    durationMinutes: number;
    days: string;
    enabled: boolean;
    rainSkip: boolean;
    priority: boolean;
    smart: boolean;
    createdAt: string;
    updatedAt: string;
}
export interface ScheduleInput {
    zone: number;
    name: string;
    startTime: string;
    startMode?: StartMode;
    startOffset?: number;
    durationMinutes: number;
    days: string;
    enabled?: boolean;
    rainSkip?: boolean;
    priority?: boolean;
    smart?: boolean;
}
export type LogStatus = 'completed' | 'rain_skip' | 'manual_stop' | 'leak_alarm' | 'error';
export interface ExecutionLog {
    id: number;
    zone: number;
    scheduleId: number | null;
    startedAt: string;
    endedAt: string | null;
    durationSeconds: number | null;
    volumeGallons: number | null;
    status: LogStatus;
    trigger: 'scheduled' | 'manual';
    notes: string | null;
}
export type AlertSeverity = 'critical' | 'warning' | 'info';
export interface Alert {
    id: number;
    severity: AlertSeverity;
    title: string;
    message: string;
    dismissed: boolean;
    createdAt: string;
}
export interface SystemStatus {
    online: boolean;
    masterValve: 'open' | 'closed';
    pressurePsi: number;
    flowGpm: number;
    dailyTotalGallons: number;
    cpuTempC: number | null;
    memoryUsagePercent: number | null;
    uptimeSeconds: number;
    rainDelayActive: boolean;
    rainDelayUntil: string | null;
    activeZones: number;
}
export interface WeatherData {
    temperatureF: number;
    humidity: number;
    precipitationProbability: number;
    description: string;
    weatherCode: number;
    forecastDays: ForecastDay[];
    heatWave: HeatWaveStatus;
}
export interface HeatWaveStatus {
    active: boolean;
    severity: 'none' | 'warning' | 'extreme';
    consecutiveDays: number;
    peakTempF: number | null;
    boostMultiplier: number;
}
export interface ForecastDay {
    date: string;
    precipitationProbability: number;
    temperatureHighF: number;
    temperatureLowF: number;
    description: string;
    weatherCode: number;
    shouldSkip: boolean;
    et0Mm: number | null;
}
export interface SystemConfig {
    zoneCount: number;
    hasRainSensor: boolean;
    hasScreen: boolean;
    moistureSensorCount: number;
    perZoneFlow: boolean;
    setupComplete: boolean;
}
export interface SetupInput {
    zoneCount: number;
    hasRainSensor?: boolean;
    hasScreen?: boolean;
    moistureSensorCount?: number;
    perZoneFlow?: boolean;
}
export type GpioRole = 'master_valve' | 'master_flow' | 'rain_sensor' | 'zone_valve' | 'zone_flow';
export interface GpioAssignment {
    id: number;
    role: GpioRole;
    pin: number;
    zone: number | null;
    label: string;
}
export interface GpioBudget {
    valid: boolean;
    totalRequired: number;
    totalAvailable: number;
    remaining: number;
    assignments: Omit<GpioAssignment, 'id'>[];
}
export interface GpioPinConfig {
    masterValvePin: number;
    masterFlowPin: number;
    rainSensorPin: number | null;
    zoneValvePins: Record<number, number>;
    zoneFlowPins: Record<number, number>;
}
export type WsEventType = 'zone:update' | 'zone:start' | 'zone:stop' | 'system:status' | 'alert:new' | 'weather:update' | 'flow:reading' | 'soil:reading' | 'schedule:triggered';
export interface WsEvent {
    type: WsEventType;
    data: unknown;
    timestamp: string;
}
//# sourceMappingURL=types.d.ts.map