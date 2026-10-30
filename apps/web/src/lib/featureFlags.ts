/**
 * Marketing-site feature flags (build-time, Vite env).
 *
 * VITE_SHOW_PRICING: the landing price table stays hidden until the owner approves the UZS prices
 * (HANDOFF §3.3, AUDIT C1/C2). Only the exact string "true" shows it, so it is hidden by default.
 */
export function showPricing(env: Record<string, unknown> = import.meta.env): boolean {
  return env.VITE_SHOW_PRICING === 'true';
}
export const SHOW_PRICING = showPricing();
