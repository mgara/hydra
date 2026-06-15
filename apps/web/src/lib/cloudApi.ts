const CLOUD_URL = (import.meta.env.VITE_CLOUD_URL as string | undefined) ?? 'http://localhost:4000';

export class CloudApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(
  path: string,
  token?: string,
  opts?: RequestInit,
): Promise<T> {
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

export interface AuthResponse {
  token: string;
  username: string;
}

export const register = (username: string, password: string) =>
  request<AuthResponse>('/api/auth/register', undefined, {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });

export const login = (username: string, password: string) =>
  request<AuthResponse>('/api/auth/login', undefined, {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });

export interface CloudSettingsData {
  theme?: string;
  tempUnit?: string;
  lengthUnit?: string;
}

export const getCloudSettings = (token: string) =>
  request<{ data: CloudSettingsData | null }>('/api/settings', token);

export const putCloudSettings = (token: string, data: CloudSettingsData) =>
  request<void>('/api/settings', token, {
    method: 'PUT',
    body: JSON.stringify({ data }),
  });
