/**
 * final-5 B1/B4/B7 + PM/Marketing copy guard: on prod-shaped rows (free 5000/100, premium 9.00 / 1000000) every plan
 * surface says Free = 20 lookups, 10 quizzes, 3 imports a day, 50 pages a month, localised en/ru/uz, soʻm only, and no
 * plan or marketing copy contains unlimited/безлимит/cheksiz, offline, 'fair use', 'no monthly fee' or '$'.
 * Pay-per-import card hidden unless PAYMENTS_UI_ENABLED=true.
 */
import assert from 'node:assert/strict';
import { enrichPlan } from '../billing/billing.service';
import { MarketingService } from './marketing.service';
import { planCopy, PLAN_LANGS } from './plan-copy';
import { setConfiguredPlanLimitsForTest } from '../../common/plan-limits';
import { paymentsUiEnabled } from '../../common/payments-ui';

const BAN = /unlimited|безлимит|cheksiz|offline|oflayn|офлайн|fair use|no monthly fee|\$/i;
const strings = (o: unknown): string[] =>
  typeof o === 'string' ? [o] : Array.isArray(o) ? o.flatMap(strings) : o && typeof o === 'object' ? Object.entries(o).flatMap(([k, v]) => (/^(unlimited|offline)/i.test(k) ? [] : strings(v))) : [];
const prodFree = { id: 'f', tier: 'free', name: 'Free', priceMonthly: 0, aiDailyQuota: 5000, importLimit: 100, offlineEnabled: false } as any;
const prodPlus = { id: 'p', tier: 'premium', name: 'Premium', priceMonthly: '9.00', aiDailyQuota: 1000000, importLimit: 1000000, offlineEnabled: false } as any;
const imports = { dailyFreeImportsPerUser: 3, monthlyFreePageLimit: 50, resetCycle: 'monthly' };
const EXPECT = {
  en: { name: 'Free', bits: ['20 word lookups a day', '10 chapter quizzes a day', '3 free imports a day', '50 free pages of imports a month'] },
  ru: { name: 'Бесплатно', bits: ['20 ', '10 ', '3 бесплатных импорта в день', '50 бесплатных страниц импорта в месяц'] },
  uz: { name: 'Bepul', bits: ['Kuniga 20 ta', 'Kuniga 10 ta', 'Kuniga 3 ta bepul import', 'Oyiga 50'] },
} as const;

setConfiguredPlanLimitsForTest({});
assert.equal(paymentsUiEnabled({}), false);
assert.equal(paymentsUiEnabled({ PAYMENTS_UI_ENABLED: 'true' } as any), true);

(async () => {
  for (const lang of PLAN_LANGS) {
    const f = enrichPlan(prodFree, lang, undefined, imports);
    const p = enrichPlan(prodPlus, lang, undefined, imports);
    assert.equal(f.name, EXPECT[lang].name, lang);
    assert.equal(f.aiDailyQuota, 20); assert.equal(f.quizDailyQuota, 10); assert.equal(f.importLimit, 3); assert.equal((f as any).monthlyFreePageLimit, 50);
    for (const b of EXPECT[lang].bits) assert.ok(f.features.some((x: string) => x.includes(b)), `${lang} billing free lacks "${b}": ${f.features.join(' | ')}`);
    assert.ok(!f.features.some((x: string) => /\b(5000|100)\b/.test(x)), `${lang}: legacy column leaked`);
    assert.equal(p.priceLabel, null, 'USD 9 never shown'); assert.equal(p.priceHidden, true);
    for (const s of [...strings(f), ...strings(p)]) assert.ok(!BAN.test(s), `${lang} billing: ${s}`);
    for (const v of Object.values(planCopy(lang))) if (typeof v === 'string') assert.ok(!BAN.test(v), `${lang} copy: ${v}`);

    const db = {
      subscriptionPlan: { findUnique: async () => prodFree },
      platformSetting: { findUnique: async () => ({ value: imports }), findMany: async () => [] },
    };
    for (const flag of [undefined, 'true']) {
      if (flag) process.env.PAYMENTS_UI_ENABLED = flag; else delete process.env.PAYMENTS_UI_ENABLED;
      const cards = await new MarketingService(db as any).plans(lang);
      assert.equal(cards.length, flag ? 2 : 1, `${lang} pay-per-import card visible=${!!flag}`);
      const free = cards[0];
      assert.equal(free.name, EXPECT[lang].name);
      for (const b of EXPECT[lang].bits) assert.ok(free.features.some((x: string) => x.includes(b)), `${lang} marketing lacks "${b}"`);
      for (const s of strings(cards)) assert.ok(!BAN.test(s), `${lang} marketing: ${s}`);
    }
    delete process.env.PAYMENTS_UI_ENABLED;
  }
  // admin-configured caps flow into every surface
  setConfiguredPlanLimitsForTest({ freeLookups: 25, freeQuizzes: 12 });
  const f = enrichPlan(prodFree, 'en', undefined, imports);
  assert.equal(f.aiDailyQuota, 25); assert.ok(f.features.includes('25 word lookups a day') && f.features.includes('12 chapter quizzes a day'));
  setConfiguredPlanLimitsForTest({});
  console.log('plan-copy-final5.test: OK (en/ru/uz; 20/10/3/50; soʻm only; banned words absent; PAYMENTS_UI off hides pay-per-import)');
})().catch((e) => { console.error(e); process.exit(1); });
