import type { MarketingPlan } from './api';

/** Web-learner app base URL (Sign in / Get for Free). */
export const LEARNER_APP_URL =
  import.meta.env.VITE_LEARNER_APP_URL ?? 'http://localhost:5175';

export type PlanTier = 'free' | 'premium';

export function loginUrl(opts?: { from?: string }) {
  const url = new URL('/login', LEARNER_APP_URL);
  url.searchParams.set('from', opts?.from ?? 'landing');
  return url.toString();
}

export function registerUrl(opts?: { plan?: PlanTier; from?: string }) {
  const url = new URL('/register', LEARNER_APP_URL);
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
    id: 'fallback-premium',
    tier: 'premium',
    name: 'Premium',
    priceMonthly: 9,
    priceLabel: '$9',
    priceUnit: 'per month',
    aiDailyQuota: 1_000_000,
    importLimit: 1_000_000,
    offlineEnabled: true,
    unlimitedLookups: true,
    unlimitedImports: true,
    popular: true,
    cta: 'Start free trial',
    features: [
      'Everything in Free',
      'Unlimited AI lookups',
      'Unlimited imports',
      'Full reading analytics',
      'Offline reading',
      'Priority support',
    ],
  },
];
