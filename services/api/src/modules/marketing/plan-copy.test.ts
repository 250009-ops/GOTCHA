import { strict as assert } from 'assert';
import { MarketingService } from './marketing.service';
import { enrichPlan } from '../billing/billing.service';
import { readFileSync } from 'fs';
import { join } from 'path';
import { BANNED_PLAN_CLAIMS, MIN_PUBLIC_PLAN_PRICE_UZS, PLAN_LANGS, PLUS_PRICE_30_UZS, PLUS_PRICE_365_UZS, formatSom, planCopy, planLang, publicPlanPriceUzs } from './plan-copy';

function assertClean(label: string, value: unknown) {
  const cards = (Array.isArray(value) ? value : [value]) as Array<Record<string, unknown>>;
  const text = JSON.stringify(cards.map((c) => [c.name, c.priceLabel, c.priceUnit, c.cta, c.features]));
  for (const re of BANNED_PLAN_CLAIMS) assert.ok(!re.test(text), `${label} contains banned claim ${re}: ${text}`);
}

async function main() {
  const prisma = { subscriptionPlan: { findUnique: async () => ({ id: 'f', tier: 'free', name: 'Free', aiDailyQuota: 50, importLimit: 3, offlineEnabled: true }) } };
  const m = new MarketingService(prisma as never);
  for (const lang of PLAN_LANGS) {
    const cards = await m.plans(lang);
    assertClean(`marketing ${lang}`, cards);
    for (const c of cards) assert.equal(c.offlineEnabled, false);
    const premium = enrichPlan({ id: 'p', tier: 'premium', name: 'Plus', priceMonthly: 24990, aiDailyQuota: 1_000_000, importLimit: 1_000_000, offlineEnabled: true, features: null } as never, lang);
    const freeRow = enrichPlan({ id: 'f', tier: 'free', name: 'Free', priceMonthly: 0, aiDailyQuota: 50, importLimit: 3, offlineEnabled: false, features: null } as never, lang);
    assertClean(`billing premium ${lang}`, premium);
    assertClean(`billing free ${lang}`, freeRow);
    assert.equal(premium.offlineEnabled, false);
    assert.equal(premium.currency, 'UZS');
    assert.match(premium.priceLabel!, lang === 'ru' ? /^24 990 сум$/ : /^24 990 soʻm$/);
    // AC1-02: named Plus, labelled as a 30-day pass; field names kept (priceMonthly).
    assert.equal(premium.name, 'Plus');
    assert.equal(premium.priceUnit, planCopy(lang).passUnit);
    assert.equal(premium.periodDays, 30); assert.equal(premium.autoRenew, false);
    assert.equal(premium.priceMonthly, 24990);
    // AC1-01: the REAL live value 9 (old USD), plus 0, null and 999 → price hidden, never "9 soʻm".
    for (const raw of [9, '9.00', 0, null, undefined, 999]) {
      const p = enrichPlan({ id: 'p', tier: 'premium', name: 'Premium', priceMonthly: raw, aiDailyQuota: 1_000_000, importLimit: 1_000_000, offlineEnabled: true, features: null } as never, lang);
      assert.equal(p.priceUzs, null, `raw ${raw}`); assert.equal(p.priceMonthly, null); assert.equal(p.priceLabel, null); assert.equal(p.priceHidden, true);
      assert.ok(!/\b9 (soʻm|сум)/.test(JSON.stringify(p)), 'never 9 soʻm');
    }
    const yr = enrichPlan({ id: 'p', tier: 'premium', name: 'Premium', priceMonthly: 24990, aiDailyQuota: 1, importLimit: 1, offlineEnabled: false, features: null } as never, lang, 199990);
    assert.equal(yr.priceYearUzs, 199990);
    // AC1-04 / AC1-05
    if (lang === 'uz') assert.ok(!/[A-Za-z]'[A-Za-z]/.test(JSON.stringify(planCopy('uz'))), 'uz uses ʻ, not ASCII apostrophe');
    if (lang === 'ru') assert.equal(planCopy('ru').ppiLabel, 'Платите только за то, что нужно');
  }
  assert.match((await m.plans('uz'))[1].features.join(' '), /Atmos/);
  assert.match((await m.plans('ru'))[0].features.join(' '), /подсказок/);
  // Limits text matches config (Free 20/10; Plus 200 quizzes, no lookup cap = null, 14:40).
  assert.match((await m.plans('en'))[0].features.join(' '), /20 word lookups a day.*10 chapter quizzes a day/);
  const pe = enrichPlan({ id: 'p', tier: 'premium', name: 'Plus', priceMonthly: 24990, aiDailyQuota: 1_000_000, importLimit: 1, offlineEnabled: false, features: null } as never, 'en');
  assert.equal(pe.aiDailyQuota, null); assert.equal(pe.quizDailyQuota, 200);
  assert.deepEqual(pe.features, ['Full AI explanations for the words you look up', '200 chapter quizzes a day', 'Everything in Free stays included']);
  assert.ok(!/unlimited|fair use|200 word lookups|200 lookups|no daily limit/i.test(JSON.stringify(pe)));
  for (const l of ['en', 'ru', 'uz'] as const) {
    const px = enrichPlan({ id: 'p', tier: 'premium', name: 'Plus', priceMonthly: 24990, aiDailyQuota: 200, importLimit: 1, offlineEnabled: false, features: null } as never, l);
    assert.ok(!/unlimited|fair use|200 (word )?lookups|no daily limit|cheksiz|безлимит|\b500\b/i.test(JSON.stringify(px.features)), l);
    assert.ok(!/\d/.test(px.features[0]), `${l}: Plus lookup line names no number`);
  }
  assert.equal(planLang('ru-RU'), 'ru'); assert.equal(planLang('xx'), 'en'); assert.equal(planLang(undefined), 'en');
  assert.equal(formatSom(199990), '199 990 soʻm');
  // Guard: no plan price under 1000 soʻm anywhere it is defined (seed, data fix, constants).
  assert.equal(publicPlanPriceUzs(MIN_PUBLIC_PLAN_PRICE_UZS - 1), null); assert.equal(publicPlanPriceUzs(1000), 1000);
  assert.ok(PLUS_PRICE_30_UZS >= 1000 && PLUS_PRICE_365_UZS >= 1000);
  const root = join(__dirname, '..', '..', '..');
  const seed = readFileSync(join(root, 'prisma', 'seed.ts'), 'utf8');
  const seedPrices = [...seed.matchAll(/priceMonthly:\s*([\d.]+)/g)].map((m) => Number(m[1])).filter((n) => n > 0);
  assert.ok(seedPrices.length >= 2, 'seed has premium prices');
  for (const n of seedPrices) assert.ok(n >= 1000, `seed price ${n} < 1000 soʻm`);
  assert.ok(/'plus\.pass\.price_365_uzs', 199990/.test(seed));
  // Price data fix SQL is owned by payments-02 (gotcha-pay), not this release.
  // AC1-03: no user-facing "unlimited imports" in import quotes
  const ic = readFileSync(join(root, 'src', 'modules', 'billing', 'import-commerce.service.ts'), 'utf8');
  assert.ok(!/freeReason[^\n]*unlimited/i.test(ic), 'freeReason must not claim unlimited imports');
  console.log('plan-copy.test: ok');
}
main().catch((e) => { console.error(e); process.exit(1); });
