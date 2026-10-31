import { refreshRejected } from './authErrors';
import { announceDailyLimit, dailyLimitText, type DailyLimitInfo } from './dailyLimit';

/** UI language for non-React callers (limit notes); LearnerShell sets <html lang> from the profile. */
export const learnerLang = (): string => currentUiLang();
function currentUiLang(): string {
  const l = typeof document !== 'undefined' ? document.documentElement.lang.slice(0, 2) : '';
  return l === 'uz' || l === 'ru' ? l : 'en';
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
          // Tester P0: a 5xx/429 from /auth/refresh must not sign the user out; only 401 does.
          if (refreshRejected(res.status)) clearTokens();
          return null;
        }
        const data = (await res.json()) as AuthTokens;
        setTokens(data);
        return data.accessToken;
      } catch {
        // Network error: keep the session; the caller surfaces an error state.
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
    // Daily caps / speed guard: the server sends uz/ru/en text naming the limit (payments-02).
    const capMsg = (err.code === 'lookup_limit' || err.code === 'quiz_limit' || err.code === 'fair_use_limit' || err.code === 'lookup_slow_down') ? (err as { messages?: Record<string, string> }).messages?.[currentUiLang()] : undefined;
    const message = capMsg ?? (Array.isArray(err.message)
      ? err.message.join(', ')
      : (err.message ?? 'Request failed'));
    const error = new Error(message) as Error & {
      code?: string;
      email?: string;
      status?: number;
    };
    if (err.code) error.code = err.code;
    if (capMsg) (error as { limit?: number }).limit = (err as { limit?: number }).limit;
    // payments-02: 429 {kind, plan, limit, resetAt} → friendly notice with the reset time (no error toast).
    const lim = err as Partial<DailyLimitInfo>;
    if ((err.code === 'lookup_limit' || err.code === 'quiz_limit') && lim.kind && lim.plan && typeof lim.limit === 'number' && lim.resetAt) {
      const info: DailyLimitInfo = { kind: lim.kind, plan: lim.plan, limit: lim.limit, plusLimit: lim.plusLimit === undefined ? lim.limit : lim.plusLimit, resetAt: lim.resetAt };
      (error as { dailyLimit?: DailyLimitInfo }).dailyLimit = info;
      error.message = dailyLimitText(info, currentUiLang()).message;
      announceDailyLimit(info);
    }
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
    const message = Array.isArray(err.message) ? err.message.join(', ') : (err.message ?? 'Audio failed');
    throw new Error(message);
  }
  return res.blob();
}
