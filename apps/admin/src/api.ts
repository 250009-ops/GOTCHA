const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
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
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? 'Request failed');
  }
  return res.json();
}

export function getToken() {
  return localStorage.getItem('gotcha_admin_token');
}

export function setToken(token: string) {
  localStorage.setItem('gotcha_admin_token', token);
}

export function clearToken() {
  localStorage.removeItem('gotcha_admin_token');
}
