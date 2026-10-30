/** Web-learner app base URL (Sign in / Get started). */
export const LEARNER_APP_URL = (
  import.meta.env.VITE_LEARNER_APP_URL ?? 'http://localhost:5175'
).replace(/\/$/, '');

/**
 * Join an app base URL with a path. Do not use `new URL('/login', base)` —
 * an absolute path replaces the base pathname (breaks path-based `/learn`).
 */
function learnerPath(path: string) {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return new URL(`${LEARNER_APP_URL}${normalized}`);
}

export type PlanTier = 'free' | 'pay-per-import';

export function loginUrl(opts?: { from?: string }) {
  const url = learnerPath('/login');
  url.searchParams.set('from', opts?.from ?? 'landing');
  return url.toString();
}

export function registerUrl(opts?: { plan?: PlanTier; from?: string; lang?: string }) {
  const url = learnerPath('/register');
  url.searchParams.set('from', opts?.from ?? 'landing');
  if (opts?.plan) url.searchParams.set('plan', opts.plan);
  if (opts?.lang) url.searchParams.set('lang', opts.lang);
  return url.toString();
}

export function libraryUrl() {
  return `${LEARNER_APP_URL}/`;
}

/**
 * P3b guard: the public learner count is only ever the live API value.
 * There is deliberately NO fallback/floor constant here (the old invented
 * fallback learner-count constant is banned; CI runs scripts/check-no-invented-counts.mjs).
 * Missing, non-numeric, negative or zero -> 0, and the UI hides the numeral.
 */
export function safeLearnerCount(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}
