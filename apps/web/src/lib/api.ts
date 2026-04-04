const BASE = '/api';

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts?.body) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE}${path}`, {
    headers,
    ...opts,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error ?? res.statusText);
  }
  return res.json();
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// ── System ──────────────────────────────────────────────

export interface HealthResponse {
  status: string;
  mode: string;
  version: string;
  uptime: number;
  ip?: string;
  hostname?: string;
  wifiRssi?: number | null;
}

export const health = () => request<HealthResponse>('/health');

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

export const getSystemStatus = () => request<SystemStatus>('/system/status');

export interface SystemConfig {
  zoneCount: number;
  hasRainSensor: boolean;
  hasScreen: boolean;
  moistureSensorCount: number;
  perZoneFlow: boolean;
  setupComplete: boolean;
}

export interface GpioAssignment {
  id: number;
  role: string;
  pin: number;
  zone: number | null;
  label: string;
}

export const getSystemConfig = () =>
  request<{ config: SystemConfig; assignments: GpioAssignment[] }>('/system/config');

export const getSettings = () => request<Record<string, string>>('/system/settings');
export const updateSettings = (body: Record<string, string>) =>
  request<Record<string, string>>('/system/settings', { method: 'PUT', body: JSON.stringify(body) });

export const setMasterValve = (state: 'open' | 'closed') =>
  request<{ masterValve: string }>('/system/master-valve', { method: 'POST', body: JSON.stringify({ state }) });

export const setRainDelay = (hours?: number, clear?: boolean) =>
  request<{ active: boolean; until: string | null }>('/system/rain-delay', {
    method: 'POST',
    body: JSON.stringify(clear ? { clear: true } : { hours }),
  });

export const forceShutdown = () =>
  request<{ success: boolean }>('/system/force-shutdown', { method: 'POST' });

// ── Alerts ──────────────────────────────────────────────

export interface Alert {
  id: number;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  dismissed: boolean;
  created_at: string;
}

export const getAlerts = (all = false) => request<Alert[]>(`/system/alerts?all=${all}`);
export const dismissAlert = (id: number) =>
  request<{ success: boolean }>(`/system/alerts/${id}/dismiss`, { method: 'POST' });

// ── Zones ───────────────────────────────────────────────

export interface ZoneState {
  zone: number;
  name: string;
  status: 'idle' | 'running' | 'scheduled';
  startedAt: string | null;
  remainingSeconds: number | null;
  lastRunAt: string | null;
  flowGpm: number;
}

export const getZones = () => request<ZoneState[]>('/zones');
export const getZone = (z: number) => request<ZoneState>(`/zones/${z}`);
export const updateZone = (z: number, body: { name?: string; enabled?: boolean }) =>
  request<ZoneState>(`/zones/${z}`, { method: 'PUT', body: JSON.stringify(body) });
export const startZone = (z: number, durationMinutes?: number) =>
  request<ZoneState>(`/zones/${z}/start`, { method: 'POST', body: JSON.stringify({ durationMinutes }) });
export const stopZone = (z: number) =>
  request<ZoneState>(`/zones/${z}/stop`, { method: 'POST' });
export const stopAllZones = () =>
  request<{ success: boolean; zones: ZoneState[] }>('/zones/stop-all', { method: 'POST' });

export interface ZoneProfile {
  zone: number;
  name: string;
  soilType: string | null;
  plantType: string | null;
  smartEnabled: boolean;
}

export interface SmartDuration {
  minutes: number;
  method: 'smart' | 'fixed';
  waterNeededIn: number;
  intakeRate: number;
  rootDepth: number;
  et0In: number | null;
  heatWaveBoost: number;
}

export const getZoneProfiles = () => request<ZoneProfile[]>('/zones/profiles');
export const updateZoneProfile = (zone: number, body: { soilType?: string | null; plantType?: string | null; smartEnabled?: boolean }) =>
  request<{ zone: number; soilType: string | null; plantType: string | null; smartEnabled: boolean }>(`/zones/${zone}/profile`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
export const getSmartDuration = (zone: number) => request<SmartDuration>(`/zones/${zone}/smart`);

// ── Schedules ───────────────────────────────────────────

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
}

export const getSchedules = (zone?: number) =>
  request<Schedule[]>(`/schedules${zone ? `?zone=${zone}` : ''}`);
export const getSchedule = (id: number) => request<Schedule>(`/schedules/${id}`);
export const createSchedule = (body: ScheduleInput) =>
  request<Schedule>('/schedules', { method: 'POST', body: JSON.stringify(body) });
export const updateSchedule = (id: number, body: Partial<ScheduleInput>) =>
  request<Schedule>(`/schedules/${id}`, { method: 'PUT', body: JSON.stringify(body) });
export const deleteSchedule = (id: number) =>
  request<{ success: boolean }>(`/schedules/${id}`, { method: 'DELETE' });

// ── Logs ────────────────────────────────────────────────

export interface ExecutionLog {
  id: number;
  zone: number;
  schedule_id: number | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  volume_gallons: number | null;
  status: string;
  trigger_type: string;
  notes: string | null;
}

export const getLogs = (opts?: { zone?: number; limit?: number; offset?: number }) => {
  const params = new URLSearchParams();
  if (opts?.zone) params.set('zone', String(opts.zone));
  if (opts?.limit) params.set('limit', String(opts.limit));
  if (opts?.offset) params.set('offset', String(opts.offset));
  return request<{ logs: ExecutionLog[]; total: number }>(`/logs?${params}`);
};

export interface RainSkipEvent {
  zone: number;
  zoneName: string;
  skippedAt: string;
  reason: string | null;
}

export const getRainSkips = () => request<RainSkipEvent[]>('/logs/rain-skips');

// ── Weather ─────────────────────────────────────────────

export interface HeatWaveStatus {
  active: boolean;
  severity: 'none' | 'warning' | 'extreme';
  consecutiveDays: number;
  peakTempF: number | null;
  boostMultiplier: number;
}

export interface WeatherData {
  temperatureF: number;
  humidity: number;
  precipitationProbability: number;
  description: string;
  weatherCode: number;
  forecastDays: {
    date: string;
    precipitationProbability: number;
    temperatureHighF: number;
    temperatureLowF: number;
    description: string;
    weatherCode: number;
    shouldSkip: boolean;
  }[];
  heatWave: HeatWaveStatus;
}

export const getWeather = () => request<WeatherData>('/weather');

// ── Matter ──────────────────────────────────────────────

export interface MatterStatus {
  enabled: boolean;
  running: boolean;
  port: number;
  commissioned: boolean;
  manualPairingCode: string | null;
  qrPairingCode: string | null;
}

export const getMatterStatus = () => request<MatterStatus>('/matter/status');

// ── Flow ────────────────────────────────────────────────

export interface FlowReading {
  id: number;
  timestamp: string;
  gpm: number;
  pulse_count: number;
  zone: number | null;
  event_type: string;
}

export interface FlowCurrent {
  gpm: number;
  totalPulses: number;
  monitoringEnabled: boolean;
  safetyEnabled: boolean;
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

export const getFlowCurrent = () => request<FlowCurrent>('/flow/current');

export const getFlowReadings = (opts?: { since?: string; zone?: number; limit?: number }) => {
  const params = new URLSearchParams();
  if (opts?.since) params.set('since', opts.since);
  if (opts?.zone) params.set('zone', String(opts.zone));
  if (opts?.limit) params.set('limit', String(opts.limit));
  return request<FlowReading[]>(`/flow/readings?${params}`);
};

export const getFlowSettings = () => request<FlowSettings>('/flow/settings');

export const updateFlowSettings = (body: Partial<FlowSettings>) =>
  request<FlowSettings>('/flow/settings', { method: 'PUT', body: JSON.stringify(body) });

// ── Soil / MQTT ──────────────────────────────────────────

export interface SoilReading {
  deviceId: string;
  friendlyName: string;
  moisture: number;
  temperature: number;
  battery: number | null;
  linkQuality: number | null;
  timestamp: string;
  zone: number | null;
}

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

export interface SoilDevice {
  device: string;
  lastSeen: string;
  zone: number | null;
  model?: string | null;
  discovered?: boolean;
}

export interface SoilZoneStatus {
  zone: number;
  skip: boolean;
  moisture: number | null;
  threshold: number;
  latest: SoilReadingRow | null;
}

export interface SoilSettings {
  moistureSkipEnabled: boolean;
  moistureSkipThreshold: number;
}

export interface MqttStatus {
  connected: boolean;
  devices: number;
}

export const getSoilCurrent = () => request<SoilReading[]>('/soil/current');

export const getSoilReadings = (opts?: { device?: string; zone?: number; since?: string; limit?: number }) => {
  const params = new URLSearchParams();
  if (opts?.device) params.set('device', opts.device);
  if (opts?.zone) params.set('zone', String(opts.zone));
  if (opts?.since) params.set('since', opts.since);
  if (opts?.limit) params.set('limit', String(opts.limit));
  return request<SoilReadingRow[]>(`/soil/readings?${params}`);
};

export const getSoilZoneStatus = (zone: number) =>
  request<SoilZoneStatus>(`/soil/zone/${zone}`);

export const getSoilDevices = () => request<SoilDevice[]>('/soil/devices');

export const setSoilZoneMapping = (device: string, zone: number | null) =>
  request<{ device: string; zone: number | null; success: boolean }>('/soil/zone-mapping', {
    method: 'PUT',
    body: JSON.stringify({ device, zone }),
  });

export const getSoilSettings = () => request<SoilSettings>('/soil/settings');

export const updateSoilSettings = (body: Partial<SoilSettings>) =>
  request<SoilSettings>('/soil/settings', { method: 'PUT', body: JSON.stringify(body) });

export const getMqttStatus = () => request<MqttStatus>('/mqtt/status');

// ── Setup ───────────────────────────────────────────────

export interface SetupStatus {
  setupComplete: boolean;
  config: SystemConfig | null;
}

export interface GpioBudget {
  valid: boolean;
  totalRequired: number;
  totalAvailable: number;
  remaining: number;
  assignments: Omit<GpioAssignment, 'id'>[];
}

export const getSetupStatus = () => request<SetupStatus>('/setup/status');

export const getGpioBudget = (opts: { zoneCount: number; hasRainSensor?: boolean; perZoneFlow?: boolean }) => {
  const params = new URLSearchParams({
    zoneCount: String(opts.zoneCount),
    hasRainSensor: String(opts.hasRainSensor ?? false),
    perZoneFlow: String(opts.perZoneFlow ?? false),
  });
  return request<GpioBudget>(`/setup/gpio-budget?${params}`);
};

export interface SetupInput {
  zoneCount: number;
  hasRainSensor?: boolean;
  hasScreen?: boolean;
  moistureSensorCount?: number;
  perZoneFlow?: boolean;
}

export interface SetupResult {
  config: SystemConfig;
  assignments: GpioAssignment[];
  budget: GpioBudget;
  message: string;
}

export const executeSetup = (body: SetupInput) =>
  request<SetupResult>('/setup', { method: 'POST', body: JSON.stringify(body) });

export const resetSetup = () =>
  request<{ success: boolean; message: string }>('/setup/reset', { method: 'POST' });
