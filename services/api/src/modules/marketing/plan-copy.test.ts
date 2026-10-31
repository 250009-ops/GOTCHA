import { strict as assert } from 'assert';
import { MarketingService } from './marketing.service';
import { enrichPlan } from '../billing/billing.service';
import { BANNED_PLAN_CLAIMS, PLAN_LANGS, formatSom, planLang } from './plan-copy';

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
    assert.match(premium.priceLabel, lang === 'ru' ? /^24 990 сум$/ : /^24 990 soʻm$/);
  }
  assert.match((await m.plans('uz'))[1].features.join(' '), /Atmos/);
  assert.match((await m.plans('ru'))[0].features.join(' '), /подсказок/);
  assert.equal(planLang('ru-RU'), 'ru'); assert.equal(planLang('xx'), 'en'); assert.equal(planLang(undefined), 'en');
  assert.equal(formatSom(199990), '199 990 soʻm');
  console.log('plan-copy.test: ok');
}
main().catch((e) => { console.error(e); process.exit(1); });
