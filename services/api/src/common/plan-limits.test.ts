import * as assert from 'node:assert/strict';
import { lookupCapped, planLimits } from './plan-limits';
import { enrichPlan } from '../modules/billing/billing.service';
import { planCopy, PLAN_LANGS } from '../modules/marketing/plan-copy';
assert.deepEqual(planLimits('free', {}), { lookupsPerDay: 20, quizzesPerDay: 10 });
assert.deepEqual(planLimits(undefined, {}), { lookupsPerDay: 20, quizzesPerDay: 10 });
// 14:40: Plus lookups are uncapped by default (null), quizzes 200. No env can re-add a Plus lookup cap.
assert.deepEqual(planLimits('premium', {}), { lookupsPerDay: null, quizzesPerDay: 200 });
assert.equal(planLimits('premium', { PLUS_DAILY_LOOKUPS: '200', PLUS_DAILY_LOOKUPS_HARD: '500' } as any).lookupsPerDay, null);
assert.equal(lookupCapped(planLimits('premium', {}).lookupsPerDay), false);
assert.equal(lookupCapped(planLimits('free', {}).lookupsPerDay), true);
assert.equal(planLimits('free', { FREE_DAILY_LOOKUPS: '25' }).lookupsPerDay, 25);
const free = enrichPlan({ tier: 'free', name: 'Free', aiDailyQuota: 50, importLimit: 15 } as any);
const plus = enrichPlan({ tier: 'premium', name: 'Premium', aiDailyQuota: 9999999, importLimit: 1 } as any);
assert.ok(free.features.includes('20 word lookups a day') && free.features.includes('10 chapter quizzes a day'), free.features.join());
assert.ok(plus.features.includes('200 chapter quizzes a day'), plus.features.join());
assert.equal(free.aiDailyQuota, 20);
assert.equal(plus.aiDailyQuota, null);
// Plus copy names no lookup number and no limit claim, in every language.
const BAN = /unlimited|fair use|200 word lookups|200 lookups|500|no daily limit|cheksiz|безлимит|без (дневного )?лимит|kunlik cheklov(siz)?/i;
for (const lang of PLAN_LANGS) {
  const p = enrichPlan({ tier: 'premium', name: 'Plus', aiDailyQuota: 200, importLimit: 1, priceMonthly: 24990 } as any, lang, 199990);
  const f = enrichPlan({ tier: 'free', name: 'Free', aiDailyQuota: 20, importLimit: 15 } as any, lang);
  for (const x of p.features) { assert.ok(!BAN.test(x), `${lang}: ${x}`); assert.ok(!/\b200\b/.test(x) || /quiz|тест|test/i.test(x), `${lang} lookup number: ${x}`); }
  for (const x of f.features) assert.ok(!BAN.test(x), `${lang}: ${x}`);
  for (const v of Object.values(planCopy(lang))) if (typeof v === 'string') assert.ok(!BAN.test(v), `${lang}: ${v}`);
}
console.log('plan-limits: OK');
