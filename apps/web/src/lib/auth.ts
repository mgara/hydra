const TOKEN_KEY = 'hydra-cloud-token';
const USER_KEY = 'hydra-cloud-user';

export interface CloudUser {
  username: string;
  token: string;
}

export function getStoredAuth(): CloudUser | null {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const username = localStorage.getItem(USER_KEY);
    if (token && username) return { token, username };
  } catch {}
  return null;
}

export function storeAuth(user: CloudUser): void {
  try {
    localStorage.setItem(TOKEN_KEY, user.token);
    localStorage.setItem(USER_KEY, user.username);
  } catch {}
}

export function clearAuth(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {}
}
