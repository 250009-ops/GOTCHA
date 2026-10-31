import * as assert from 'node:assert/strict';
import { enrichPlan } from './billing.service';
const BANNED = [/unlimited/i, /offline/i, /no ads/i, /priority support/i, /\$/, /\/mo\b/];
const base = { id: 'x', aiDailyQuota: 50, importLimit: 3, offlineEnabled: true } as any;
const p = enrichPlan({ ...base, tier: 'premium', name: 'Premium', priceMonthly: 9 });
const f = enrichPlan({ ...base, tier: 'free', name: 'Free', priceMonthly: 0 });
for (const plan of [p, f]) {
  const text = JSON.stringify([plan.features, plan.priceLabel, plan.priceUnit]);
  for (const re of BANNED) assert.ok(!re.test(text), `${re} in ${text}`);
  assert.equal(plan.offlineEnabled, false);
}
// Copy follows common/plan-limits (Plus 200 AI + 200 quizzes). The 50% import discount bullet is not in the
// shipped copy (payments-01 owns it; add only once it is live).
assert.ok(p.features.some((x: string) => /200 full AI explanations/.test(x)), JSON.stringify(p.features));
assert.ok(!JSON.stringify(p.features).includes('No daily limit'));
// Prices come from the DB (payments-02 data fix); a stale USD-like price (9) is hidden, never shown as $.
assert.equal(p.priceMonthly, null); assert.equal(p.priceHidden, true); assert.equal(p.autoRenew, false);
const live = enrichPlan({ ...base, tier: 'premium', name: 'Plus', priceMonthly: 24990 }, 'en', 199990);
assert.equal(live.priceMonthly, 24990); assert.equal(live.priceYearUzs, 199990); assert.equal(live.autoRenew, false);
console.log('plan-claims: OK');
