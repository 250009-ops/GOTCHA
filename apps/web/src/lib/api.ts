const API_BASE = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:3000/api/v1' : '/api/v1');

export type MarketingPlan = {
  id: string;
  tier: 'free' | 'pay-per-import' | string;
  name: string;
  priceMonthly: number;
  priceLabel: string;
  priceUnit: string;
  aiDailyQuota: number;
  importLimit: number;
  offlineEnabled: boolean;
  unlimitedLookups: boolean;
  unlimitedImports: boolean;
  popular: boolean;
  cta: string;
  features: string[];
};

export type MarketingStats = {
  learnerCount: number;
  displayLearnerCount: number;
};

export type LandingCatalogItem = {
  id: string;
  slug: string;
  title: string;
  author: string | null;
  coverImageUrl: string | null;
  language: string;
  cefr: string;
  contentType: string;
  isFree: boolean;
  priceUzs: number;
};

export type LandingImportPricing = {
  currency: 'UZS';
  atmosMinAmountSom: number;
  freeLimits: {
    dailyFreeImportsPerUser: number;
    monthlyFreePageLimit: number;
    allowedFormats: string[];
    resetCycle: 'daily' | 'monthly' | 'yearly';
  };
  tiers: Array<{
    id: string;
    label: string;
    minPages: number;
    maxPages: number | null;
    priceUzs: number;
    sortOrder: number;
  }>;
};

export type LandingTopReader = {
  rank: number;
  displayName: string;
  initials: string;
  minutesRead: number;
  streakDays: number;
  wordsLearned: number;
};

export type LandingPayload = {
  generatedAt: string;
  stats: { learnerCount: number };
  languages: Array<{
    code: string;
    name: string;
    nativeName: string;
    flagEmoji: string;
  }>;
  catalog: { source: 'featured' | 'recent'; items: LandingCatalogItem[] };
  importPricing: LandingImportPricing;
  topReaders: LandingTopReader[];
};

export async function fetchMarketingPlans(): Promise<MarketingPlan[]> {
  const res = await fetch(`${API_BASE}/marketing/plans`);
  if (!res.ok) throw new Error(`Plans query failed (${res.status})`);
  return res.json();
}

export async function fetchMarketingStats(): Promise<MarketingStats> {
  const res = await fetch(`${API_BASE}/marketing/stats`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Stats query failed (${res.status})`);
  return res.json();
}

export async function fetchMarketingLanding(): Promise<LandingPayload> {
  const res = await fetch(`${API_BASE}/marketing/landing`);
  if (!res.ok) throw new Error(`Landing query failed (${res.status})`);
  return res.json();
}
