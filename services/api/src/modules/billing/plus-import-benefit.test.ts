/** Plus import benefit is 50% off paid imports. Copy and plan data must not give Plus a "20 free imports" pool. */
import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { enrichPlan, plusImportLimits } from './billing.service';
import { planCopy } from '../marketing/plan-copy';
import { ImportCommerceService } from './import-commerce.service';

const root = join(__dirname, '..', '..', '..', '..', '..');
const PLUS_FREE_POOL = /20 free imports|20 imports a day and 2[, ]?000|Plus gives you 20 imports|Plus: up to 20 imports|до 20 импортов в день и 2|kuniga 20 tagacha import|Plus bilan kuniga 20 ta import|С Plus до 20 импортов/i;

const COPY_FILES = [
  'apps/web/src/lib/landingCopy.ts',
  'apps/web/legal-pm-payments/terms-en.html',
  'apps/web/legal-pm-payments/terms-ru.html',
  'apps/web/legal-pm-payments/terms-uz.html',
  'apps/web/legal-pm-payments/oferta-en.html',
  'apps/web/legal-pm-payments/oferta-ru.html',
  'apps/web/legal-pm-payments/oferta-uz.html',
  'packages/shared/src/payCopy.ts',
  'packages/shared/src/learnerCopy.ts',
  'apps/web-learner/src/pages/SettingsPage.tsx',
];

(async () => {
  const stored = { dailyFreeImportsPerUser: 3, monthlyFreePageLimit: 50, plusDailyImportsPerUser: 20, plusMonthlyPageLimit: 2000 };
  const prisma = { platformSetting: { findUnique: async () => ({ value: stored }) } };
  const pool = await plusImportLimits(prisma);
  assert.deepEqual(pool, { imports: 3, pages: 50, cycle: 'monthly' });

  const plan = { id: 'p', tier: 'premium', name: 'Plus', priceMonthly: 24990, importLimit: 3, aiDailyQuota: 1, quizDailyQuota: 1, features: [] };
  for (const lang of ['en', 'ru', 'uz'] as const) {
    const card = enrichPlan(plan as never, lang, undefined, 20, 10, null, 3, 200, { pages: 50, cycle: 'monthly' }, { imports: 20, pages: 2000, cycle: 'monthly' });
    const text = card.features.join('\n');
    assert.equal(card.importLimit, 3, lang);
    assert.equal(card.monthlyFreePageLimit, 50, lang);
    assert.doesNotMatch(text, PLUS_FREE_POOL, `${lang} plan: ${text}`);
    assert.doesNotMatch(text, /20 free imports/i, lang);
    assert.match(text, /50%/);
    assert.ok(card.features.includes(planCopy(lang).plusImportOff), lang);
  }

  const free = enrichPlan({ ...plan, tier: 'free', priceMonthly: 0 } as never, 'en', undefined, 20, 10, null, 3, 200, { pages: 50, cycle: 'monthly' });
  assert.ok(free.features.includes('3 free imports a day'));
  assert.ok(free.features.includes('Up to 50 free pages of imports a month'));

  for (const rel of COPY_FILES) {
    const text = readFileSync(join(root, rel), 'utf8');
    assert.doesNotMatch(text, PLUS_FREE_POOL, rel);
    assert.doesNotMatch(text, /20 free imports/i, rel);
  }

  const commerce = Object.create(ImportCommerceService.prototype) as ImportCommerceService & {
    prisma: unknown;
    gatewayEnabled: () => boolean;
    freeUsage: () => Promise<{ dailyFreeUsed: number; monthlyPagesUsed: number }>;
  };
  commerce.prisma = {
    platformSetting: { findUnique: async () => ({ value: stored }), findMany: async () => [] },
    userSubscription: { findFirst: async () => ({ status: 'active', plan: { tier: 'premium' } }) },
    entitlement: { findFirst: async () => null },
  };
  commerce.gatewayEnabled = () => false;
  commerce.freeUsage = async () => ({ dailyFreeUsed: 1, monthlyPagesUsed: 4 });
  const allowance = await commerce.learnerAllowance('u');
  assert.equal(allowance.tier, 'plus');
  assert.equal(allowance.dailyFreeImportsPerUser, 3);
  assert.equal(allowance.monthlyFreePageLimit, 50);
  assert.doesNotMatch(JSON.stringify(allowance), /20 free imports/);

  console.log('plus-import-benefit: ok');
})().catch((e) => { console.error(e); process.exit(1); });
