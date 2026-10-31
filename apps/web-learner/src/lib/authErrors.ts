/**
 * Tester P0 (stats 502 → silent logout): only an HTTP 401 means the session is gone.
 * 5xx, 429, timeouts and network errors keep the session and show an error state instead.
 */
export function statusOf(err: unknown): number | undefined {
  const s = (err as { status?: unknown } | null)?.status;
  return typeof s === 'number' ? s : undefined;
}

export function isSessionRejected(err: unknown): boolean {
  return statusOf(err) === 401;
}

/** For /auth/refresh: drop stored tokens only when the server rejects the refresh token. */
export function refreshRejected(status: number): boolean {
  return status === 401;
}
