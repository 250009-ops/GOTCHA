import * as assert from 'node:assert/strict';
import { enrichPlan } from './billing.service';
// Copy guard (wlive G1) after the payments-02 port: the payments-02 copy wins (PLUS-OFFER §4, 14:33/14:40).
// Plus = no daily lookup cap, shown as "No daily limit on word lookups (20 a day on Free)"; 200 quizzes; no fair-use / unlimited.
const BANNED = [/unlimited/i, /fair use/i, /200 word lookups/i, /200 lookups/i, /offline/i, /no ads/i, /priority support/i, /\$/, /\/mo\b/];
const base = { id: 'x', aiDailyQuota: 20, quizDailyQuota: 10, importLimit: 3, offlineEnabled: true } as any;
const p = enrichPlan({ ...base, tier: 'premium', name: 'Premium', priceMonthly: 9, quizDailyQuota: 200 });
const f = enrichPlan({ ...base, tier: 'free', name: 'Free', priceMonthly: 0 });
for (const plan of [p, f]) {
  const text = JSON.stringify([plan.features, plan.priceLabel, plan.priceUnit]);
  for (const re of BANNED) assert.ok(!re.test(text), `${re} in ${text}`);
  assert.equal(plan.offlineEnabled, false);
}
assert.equal(p.features[0], 'No fixed daily limit on word lookups (20 a day on Free)', JSON.stringify(p.features));
assert.equal(p.features[1], 'No daily limit on Mashq (20 questions a day on Free, across all books)', JSON.stringify(p.features));
// A stale USD-like price (9) is hidden, never shown as $.
assert.equal(p.priceMonthly, null); assert.equal(p.priceHidden, true); assert.equal(p.autoRenew, false);
const live = enrichPlan({ ...base, tier: 'premium', name: 'Plus', priceMonthly: 24990 }, 'en', 199990);
assert.equal(live.priceMonthly, 24990); assert.equal(live.priceYearUzs, 199990); assert.equal(live.autoRenew, false);
console.log('plan-claims: OK');
