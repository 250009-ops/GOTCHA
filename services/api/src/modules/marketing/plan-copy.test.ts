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
    const premium = enrichPlan({ id: 'p', tier: 'premium', name: 'Plus', priceMonthly: 24990, aiDailyQuota: 200, importLimit: 1_000_000, offlineEnabled: true, features: null } as never, lang);
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
  assert.equal((await m.plans('uz')).length, 1, 'final-5 B4: pay-per-import card hidden while PAYMENT_GATEWAY_ENABLED is off');
  process.env.PAYMENT_GATEWAY_ENABLED = 'true';
  assert.match((await m.plans('uz'))[1].features.join(' '), /Atmos/);
  delete process.env.PAYMENT_GATEWAY_ENABLED;
  // WLF-04: Free card states the real import allowance (defaults 3/day + 50 pages/month), never 15.
  const fe: string[] = (await m.plans('en'))[0].features; const fr: string[] = (await m.plans('ru'))[0].features; const fu: string[] = (await m.plans('uz'))[0].features;
  assert.ok(fe.includes('3 free imports a day') && fe.includes('Up to 50 free pages of imports a month'), fe.join(' | '));
  assert.ok(fr.includes('3 бесплатных импорта в день') && fr.includes('До 50 бесплатных страниц импорта в месяц'), fr.join(' | '));
  assert.ok(fu.includes('Kuniga 3 ta bepul import') && fu.includes('Oyiga 50 sahifagacha bepul import'), fu.join(' | '));
  for (const f of [fe, fr, fu]) assert.ok(!/\b15\b/.test(f.join(' ')), 'no 15');
  const m2 = new MarketingService({ ...prisma, platformSetting: { findUnique: async () => ({ value: { dailyFreeImportsPerUser: 5, monthlyFreePageLimit: 21 } }) } } as never);
  const f2: string[] = (await m2.plans('ru'))[0].features;
  assert.ok(f2.includes('5 бесплатных импортов в день') && f2.includes('До 21 бесплатной страницы импорта в месяц'), 'reads admin config: ' + f2.join(' | '));
  assert.match((await m.plans('ru'))[0].features.join(' '), /пояснений слов/);
  assert.equal(planLang('ru-RU'), 'ru'); assert.equal(planLang('xx'), 'en'); assert.equal(planLang(undefined), 'en');
  assert.equal(formatSom(199990), '199 990 soʻm');
  // Guard: no plan price under 1000 soʻm anywhere it is defined (seed, data fix, constants).
  assert.equal(publicPlanPriceUzs(MIN_PUBLIC_PLAN_PRICE_UZS - 1), null); assert.equal(publicPlanPriceUzs(1000), 1000);
  assert.ok(PLUS_PRICE_30_UZS >= 1000 && PLUS_PRICE_365_UZS >= 1000);
  const root = join(__dirname, '..', '..', '..');
  const seedJson = JSON.parse(readFileSync(join(root, 'prisma', 'pricing-seed.json'), 'utf8')) as { subscriptionPlans: Array<{ tier: string; priceMonthly: number }> };
  const prem = seedJson.subscriptionPlans.find((p) => p.tier === 'premium')!;
  assert.equal(prem.priceMonthly, PLUS_PRICE_30_UZS, 'seed premium = 24990 (option C)');
  for (const p of seedJson.subscriptionPlans) assert.ok(p.priceMonthly === 0 || p.priceMonthly >= 1000, `seed price ${p.priceMonthly} < 1000 soʻm`);
  const sql = readFileSync(join(root, 'prisma', 'data-fixes', '2026-10-31-plus-price-uzs.sql'), 'utf8');
  assert.match(sql, /SET price_monthly = 24990/); assert.match(sql, /'199990'::jsonb/);
  for (const m of sql.matchAll(/price_monthly = (\d+)/g)) assert.ok(Number(m[1]) >= 1000);
  // AC1-03: no user-facing "unlimited imports" in import quotes
  const ic = readFileSync(join(root, 'src', 'modules', 'billing', 'import-commerce.service.ts'), 'utf8');
  assert.ok(!/freeReason[^\n]*unlimited/i.test(ic), 'freeReason must not claim unlimited imports');
  // PLUS-OFFER Defaults #4: Plus copy names the real cap, never "unlimited" / "no daily limit".
  const pe = enrichPlan({ id: 'p', tier: 'premium', name: 'Plus', priceMonthly: 24990, aiDailyQuota: 200, importLimit: 1_000_000, offlineEnabled: true, features: null } as never, 'en');
  assert.equal(pe.features[0], 'No daily limit on word lookups (20 a day on Free)'); // PLUS-OFFER §4 14:33
  assert.equal(planCopy('en').plusLookups(200, 20), '200 word lookups a day (20 on Free)', 'a configured Plus cap is named');
  assert.equal(pe.features[1], '200 chapter quizzes a day (10 on Free)'); // Marketing §4/§7 14:20
  assert.equal(planCopy('uz').plusQuizzes(200, 10), 'Kuniga 200 ta bob testi (bepul tarifda 10 ta)');
  assert.equal(planCopy('ru').plusQuizzes(200, 10), '200 тестов по главам в день (в бесплатном плане 10)');
  assert.match(sql, /features - 'ai_lookup_unlimited'/); assert.match(sql, /'plus.ai_lookup_quota', 'null'::jsonb/); assert.doesNotMatch(sql, /ai_daily_quota = (200|1000000)/); assert.match(sql, /quiz_daily_quota = 200/);
  assert.match(sql, /DATABASE_URL%%\\\?\*/, 'backup strips ?schema=');
  assert.equal(pe.offlineEnabled, false);
  for (const l of PLAN_LANGS) assert.ok(!/unlimited|fair use|безлимит|cheksiz/i.test(JSON.stringify(planCopy(l)) + planCopy(l).plusLookups(200, 50)), l);
  console.log('plan-copy.test: ok');
}
main().catch((e) => { console.error(e); process.exit(1); });
