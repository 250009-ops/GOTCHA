import { localizeApiError } from '@gotcha/shared';
import { readStoredLearnerLocale, detectLearnerLocale } from './learnerLocale';

function currentUiLang(): string {
  if (typeof document !== 'undefined' && document.documentElement.lang) return document.documentElement.lang.slice(0, 2);
  return readStoredLearnerLocale() ?? detectLearnerLocale();
}
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

const ACCESS_KEY = 'gotcha_learner_access';
const REFRESH_KEY = 'gotcha_learner_refresh';

/** Auth endpoints that must not send Bearer tokens or trigger /auth/refresh. */
const PUBLIC_AUTH_API = new Set([
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/verify-email',
  '/auth/resend-verification',
  '/auth/forgot-password',
  '/auth/reset-password',
]);

function isPublicAuthApi(path: string) {
  const bare = path.split('?')[0] ?? path;
  return PUBLIC_AUTH_API.has(bare);
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens(tokens: AuthTokens) {
  localStorage.setItem(ACCESS_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
}

export function clearTokens() {
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
          clearTokens();
          return null;
        }
        const data = (await res.json()) as AuthTokens;
        setTokens(data);
        return data.accessToken;
      } catch {
        clearTokens();
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
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string>),
  };
  // Let the browser set multipart boundary when uploading files.
  if (isFormData) delete headers['Content-Type'];

  const publicAuth = isPublicAuthApi(path);
  // Explicit null means "no auth"; undefined falls back to stored access token.
  const accessToken = publicAuth ? (token ?? null) : (token === undefined ? getAccessToken() : token);
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  // Never refresh on public auth calls (e.g. login 401 EMAIL_NOT_VERIFIED with a stale token).
  if (res.status === 401 && accessToken && !publicAuth) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers.Authorization = `Bearer ${newToken}`;
      res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText })) as {
      message?: string | string[];
      code?: string;
      email?: string;
      statusCode?: number;
    };
    // BUG-10: never surface raw English server text in RU/UZ.
    const message = localizeApiError(currentUiLang(), {
      message: err.message,
      code: err.code,
      status: err.statusCode ?? res.status,
    });
    const error = new Error(message) as Error & {
      code?: string;
      email?: string;
      status?: number;
    };
    if (err.code) error.code = err.code;
    if (err.email) error.email = err.email;
    error.status = err.statusCode ?? res.status;
    throw error;
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

/** Binary POST helper for TTS audio (and similar). */
export async function apiAudio(
  path: string,
  body: Record<string, unknown>,
): Promise<Blob> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const accessToken = getAccessToken();
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (res.status === 401 && accessToken) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers.Authorization = `Bearer ${newToken}`;
      res = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
    }
  }

  if (!res.ok) {
    const err = (await res.json().catch(() => ({ message: res.statusText }))) as {
      message?: string | string[];
    };
    const message = localizeApiError(currentUiLang(), { message: err.message, status: res.status });
    throw new Error(message);
  }
  return res.blob();
}
