const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

export type MarketingPlan = {
  id: string;
  tier: 'free' | 'premium' | string;
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

export async function fetchMarketingPlans(): Promise<MarketingPlan[]> {
  const res = await fetch(`${API_BASE}/marketing/plans`);
  if (!res.ok) throw new Error(`Plans query failed (${res.status})`);
  return res.json();
}

export async function fetchMarketingStats(): Promise<MarketingStats> {
  const res = await fetch(`${API_BASE}/marketing/stats`);
  if (!res.ok) throw new Error(`Stats query failed (${res.status})`);
  return res.json();
}
