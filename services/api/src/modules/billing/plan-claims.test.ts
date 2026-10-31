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
assert.ok(p.features.includes('200 AI lookups/day'));
assert.ok(p.features.includes('50% off paid imports'));
assert.equal(p.priceMonthly, 24990); assert.equal(p.priceYearUzs, 199990); assert.equal(p.autoRenew, false);
console.log('plan-claims: OK');
