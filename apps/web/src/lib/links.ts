import type { MarketingPlan } from './api';

/** Web-learner app base URL (Sign in / Get for Free). */
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

export function registerUrl(opts?: { plan?: PlanTier; from?: string }) {
  const url = learnerPath('/register');
  url.searchParams.set('from', opts?.from ?? 'landing');
  if (opts?.plan) url.searchParams.set('plan', opts.plan);
  return url.toString();
}

/** Figma Landing fallbacks when marketing API is offline. */
export const FALLBACK_LEARNER_COUNT = 12_840;

export const FALLBACK_PLANS: MarketingPlan[] = [
  {
    id: 'fallback-free',
    tier: 'free',
    name: 'Free',
    priceMonthly: 0,
    priceLabel: '$0',
    priceUnit: 'forever',
    aiDailyQuota: 50,
    importLimit: 15,
    offlineEnabled: false,
    unlimitedLookups: false,
    unlimitedImports: false,
    popular: false,
    cta: 'Get started',
    features: [
      'Access to public library',
      '50 AI lookups / day',
      '15 imports',
      'Basic SRS review',
      '7-day reading history',
    ],
  },
  {
    id: 'fallback-pay-per-import',
    tier: 'pay-per-import',
    name: 'Pay-per-import',
    priceMonthly: 0,
    priceLabel: 'Pay as you go',
    priceUnit: 'no subscription',
    aiDailyQuota: 50,
    importLimit: 15,
    offlineEnabled: true,
    unlimitedLookups: false,
    unlimitedImports: false,
    popular: true,
    cta: 'Start reading for free',
    features: [
      'Everything in Free',
      'No monthly fee, ever',
      'Need more than your free imports? Pay once per import via Atmos',
      'Price shown upfront, based on document length',
      'Full reading analytics',
      'Offline reading',
    ],
  },
];
