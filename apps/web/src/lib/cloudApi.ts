import type { ZoneProfile, Schedule, FlowSettings, SoilSettings } from './api';

const CLOUD_URL = (import.meta.env.VITE_CLOUD_URL as string | undefined) ?? 'http://localhost:4000';

export class CloudApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, token?: string, opts?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts?.body) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${CLOUD_URL}${path}`, { ...opts, headers });
  if (res.status === 204) return undefined as T;
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new CloudApiError(res.status, (body as { error?: string }).error ?? res.statusText);
  }
  return res.json();
}

// ── Auth ────────────────────────────────────────────────

export interface AuthResponse { token: string; username: string }

export const cloudRegister = (username: string, password: string) =>
  request<AuthResponse>('/api/auth/register', undefined, {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });

export const cloudLogin = (username: string, password: string) =>
  request<AuthResponse>('/api/auth/login', undefined, {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });

// ── Data ────────────────────────────────────────────────

export interface BackupIndex { key: string; updatedAt: string }

export const listBackupKeys = (token: string) =>
  request<BackupIndex[]>('/api/data', token);

export const getBackupData = <T>(token: string, key: string) =>
  request<{ key: string; data: T; updatedAt: string }>(`/api/data/${key}`, token);

export const putBackupData = (token: string, key: string, data: unknown) =>
  request<void>(`/api/data/${key}`, token, {
    method: 'PUT',
    body: JSON.stringify({ data }),
  });

// ── Typed backup shapes ───────────────────────────────

export interface SettingsBackup {
  theme?: string;
  temp_unit?: string;
  length_unit?: string;
  weather_lat?: string;
  weather_lon?: string;
  weather_location_name?: string;
  hardinessZone?: string | null;
}

export type ZonesBackup = ZoneProfile[];
export type SchedulesBackup = Pick<Schedule,
  'zone' | 'name' | 'startTime' | 'startMode' | 'startOffset' |
  'durationMinutes' | 'days' | 'enabled' | 'rainSkip' | 'priority' | 'smart' | 'expiresAt'
>[];
export type FlowBackup = FlowSettings;
export type SoilBackup = SoilSettings;
