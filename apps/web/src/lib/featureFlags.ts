/**
 * Marketing-site feature flags (build-time, Vite env).
 *
 * VITE_SHOW_PRICING: the landing price table stays hidden until the owner approves the UZS prices
 * (AUDIT C1/C2). Only the exact string "true" shows it, so it is hidden by default.
 * Written as a direct `import.meta.env` comparison so Vite inlines it and drops the
 * price table from the bundle entirely when the flag is off.
 */
export function showPricing(env: Record<string, unknown>): boolean {
  return env.VITE_SHOW_PRICING === 'true';
}
export const SHOW_PRICING: boolean = import.meta.env.VITE_SHOW_PRICING === 'true';
