/** Forgot-password limiter: 5 hits per 15 minutes, tracked separately per IP and per identifier. */
export const FORGOT_LIMIT = 5;
export const FORGOT_WINDOW_MS = 15 * 60 * 1000;

export function takeForgotSlot(store: Map<string, number[]>, key: string, now = Date.now()): boolean {
  const prev = (store.get(key) ?? []).filter((t) => now - t < FORGOT_WINDOW_MS);
  if (prev.length >= FORGOT_LIMIT) {
    store.set(key, prev);
    return false;
  }
  prev.push(now);
  store.set(key, prev);
  return true;
}
