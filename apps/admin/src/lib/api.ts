const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

const ACCESS_KEY = 'gotcha_admin_token';
const REFRESH_KEY = 'gotcha_admin_refresh';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export function getToken() {
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(ACCESS_KEY, token);
}

export function setTokens(tokens: AuthTokens) {
  localStorage.setItem(ACCESS_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
}

export function clearToken() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) {
          clearToken();
          return null;
        }
        const data = (await res.json()) as AuthTokens;
        setTokens(data);
        return data.accessToken;
      } catch {
        clearToken();
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const accessToken = token ?? getToken();
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401 && accessToken) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers.Authorization = `Bearer ${newToken}`;
      res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    const message = Array.isArray(err.message) ? err.message.join(', ') : (err.message ?? 'Request failed');
    const apiError = new Error(message) as Error & { status?: number };
    apiError.status = res.status;
    throw apiError;
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export async function apiUpload<T>(path: string, file: File, field = 'file'): Promise<T> {
  const accessToken = getToken();
  const send = async (token: string | null) => {
    const form = new FormData();
    form.append(field, file);
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(`${API_BASE}${path}`, { method: 'POST', headers, body: form });
  };
  let res = await send(accessToken);
  if (res.status === 401 && accessToken) {
    const newToken = await refreshAccessToken();
    if (newToken) res = await send(newToken);
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    const message = Array.isArray(err.message) ? err.message.join(', ') : (err.message ?? 'Upload failed');
    throw new Error(message);
  }
  return res.json();
}
