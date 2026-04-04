// HTTP API client for communicating with the Hydra server
let baseUrl = '';

export function setBaseUrl(url: string) {
  baseUrl = url.replace(/\/$/, '');
}

export function getBaseUrl() {
  return baseUrl;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${baseUrl}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status}: ${body}`);
  }
  return res.json();
}

// System
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

export function getSystemStatus(): Promise<SystemStatus> {
  return request('/api/system/status');
}

// Zones
export interface Zone {
  zone: number;
  name: string;
  status: 'idle' | 'running';
  startedAt: string | null;
  remainingSeconds: number | null;
  lastRunAt: string | null;
  flowGpm: number;
}

export function getZones(): Promise<Zone[]> {
  return request('/api/zones');
}

export function startZone(zone: number, durationMinutes: number): Promise<void> {
  return request(`/api/zones/${zone}/start`, {
    method: 'POST',
    body: JSON.stringify({ durationMinutes }),
  });
}

export function stopZone(zone: number): Promise<void> {
  return request(`/api/zones/${zone}/stop`, { method: 'POST' });
}

// Force shutdown
export function forceShutdown(): Promise<void> {
  return request('/api/system/force-shutdown', { method: 'POST' });
}
