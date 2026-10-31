// payments-02 daily caps (Sarvarbek 14:32/14:36, Kai 14:20, Marketing PLUS-OFFER §4 14:33).
// Free 20 lookups + 10 quizzes; Plus 200 quizzes and NO daily lookup cap (plus.ai_lookup_quota = null).
// Dormant capped path (config only), Tashkent-midnight reset, silent speed guard, per-lookup cost log.
import * as assert from 'node:assert/strict';
import { DAILY_CAP_FALLBACKS, LOOKUP_BURST_FALLBACKS, limitResetLine, plusHeadline, plusLead, plusLookupsBullet } from '@gotcha/shared';
import { getPlanCaps, resetPlanCapsCache, PLAN_CAPS_TTL_MS, usageDayStart, usageResetAt } from './plan-caps';
import { defaultAiPlatformSettings } from '../modules/ai/ai-settings';
import { LimitsService } from '../services/limits.service';
import { AiService } from '../modules/ai/ai.service';
import { ImportCommerceService } from '../modules/billing/import-commerce.service';

type Plans = { free?: { ai: number; quiz: number }; premium?: { ai: number; quiz: number } };
const SEEDED: Plans = { free: { ai: 20, quiz: 10 }, premium: { ai: 1_000_000, quiz: 200 } }; // wlive 0020 premium 1e6 is ignored
type Settings = Record<string, unknown>;

function db(plan: 'free' | 'plus', used: { lookups?: number; quizzes?: number }, plans: Plans = SEEDED, settings: Settings = {}) {
  const calls = { upserts: 0, costRows: [] as any[] };
  // WLF-12: the admin caps live in platform_settings; `plans` here is that config (plan columns are no longer read).
  const P: any = plans;
  const cfgOf = (): Settings => ({ ...(P.free?.ai != null ? { 'caps.free.lookups': P.free.ai } : {}), ...(P.free?.quiz != null ? { 'caps.free.quizzes': P.free.quiz } : {}), ...(P.premium?.quiz != null ? { 'caps.plus.quizzes': P.premium.quiz } : {}), ...settings });
  return {
    calls,
    dbAvailable: true,
    subscriptionPlan: { findMany: async () => Object.entries(plans).map(([tier, v]) => ({ tier, aiDailyQuota: v!.ai, quizDailyQuota: v!.quiz })) },
    userSubscription: { findFirst: async () => (plan === 'plus' ? { plan: { tier: 'premium' } } : null) },
    platformSetting: {
      findUnique: async ({ where }: any) => (where.key in settings ? { key: where.key, value: settings[where.key] } : null),
      findMany: async ({ where }: any) => (where?.key?.in ?? []).filter((k: string) => k in cfgOf()).map((key: string) => ({ key, value: cfgOf()[key] })),
    },
    aiUsageDaily: {
      findUnique: async () => ({ lookupCount: used.lookups ?? 0, quizCount: used.quizzes ?? 0 }),
      upsert: async () => { calls.upserts += 1; return {}; },
    },
    aiLookupCost: { create: async ({ data }: any) => { calls.costRows.push(data); return data; } },
    lemmaCache: { findUnique: async () => null, findFirst: async () => ({ lemma: 'run', translation: 'yugurmoq', partOfSpeech: 'verb' }) },
  } as any;
}
const CAPPED: Settings = { 'plus.ai_lookup_quota': 200, 'plus.lookup_hard_cap': 500 };

const lookupCheck = (d: any) => (new AiService(d) as any).checkQuota('u', 20) as Promise<{ mode: 'ai' | 'dictionary' }>;
const quizCheck = (d: any) => new LimitsService(d).assertQuizAllowed('u');
async function limit429(p: Promise<unknown>) {
  try { await p; } catch (e: any) { assert.equal(e.getStatus?.(), 429); return e.getResponse(); }
  return assert.fail('expected HTTP 429');
}
const tests: Array<[string, () => Promise<void>]> = [];
const test = (name: string, fn: () => Promise<void>) => tests.push([name, fn]);

// ---- Free lookups (20)
test('free lookups: 20th lookup (19 used) is allowed', async () => {
  assert.equal((await lookupCheck(db('free', { lookups: 19 }))).mode, 'ai');
});
test('free lookups: 21st lookup (20 used) is refused with 429 lookup_limit limit 20 + Marketing copy', async () => {
  const b = await limit429(lookupCheck(db('free', { lookups: 20 })));
  assert.equal(b.code, 'lookup_limit'); assert.equal(b.kind, 'lookups'); assert.equal(b.limit, 20); assert.equal(b.plan, 'free');
  assert.equal(b.messages.en, "You've used today's 20 word lookups. Get Plus for no daily limit on word lookups, or come back tomorrow.");
  assert.equal(b.messages.uz, 'Bugungi 20 ta soʻz izohi tugadi. Soʻz izohlarida kunlik cheklov boʻlmasligi uchun Plusʼni oling yoki ertaga qayting.');
  assert.equal(b.messages.ru, 'Вы использовали 20 пояснений слов за сегодня. С Plus нет дневного лимита на пояснения слов. Или возвращайтесь завтра.');
  for (const m of Object.values<string>(b.messages)) assert.doesNotMatch(m, /unlimited|fair use|безлимит|cheksiz/i);
});
// ---- Free quizzes (10)
test('free quizzes: 10th quiz (9 used) is allowed', async () => { await quizCheck(db('free', { quizzes: 9 })); });
test('free quizzes: 11th quiz (10 used) is refused with 429 quiz_limit limit 10', async () => {
  const b = await limit429(quizCheck(db('free', { quizzes: 10 })));
  assert.equal(b.code, 'quiz_limit'); assert.equal(b.limit, 10);
  assert.equal(b.messages.en, "You've used today's chapter quizzes. They reset tomorrow.");
});
test('free quizzes use quiz_daily_quota, not ai_daily_quota', async () => { await limit429(quizCheck(db('free', { lookups: 0, quizzes: 10 }))); });
// ---- Plus lookups: unlimited by default
test('plus lookups (default config, keys null): 10,000 used is still a full AI lookup', async () => {
  assert.equal((await lookupCheck(db('plus', { lookups: 10_000 }))).mode, 'ai');
  assert.equal((await lookupCheck(db('plus', { lookups: 10_000 }, SEEDED, { 'plus.ai_lookup_quota': null, 'plus.lookup_hard_cap': null }))).mode, 'ai');
});
test('plus lookups: legacy premium ai_daily_quota (1,000,000 or 200) never caps Plus', async () => {
  assert.equal((await lookupCheck(db('plus', { lookups: 5000 }, { free: { ai: 20, quiz: 10 }, premium: { ai: 200, quiz: 200 } }))).mode, 'ai');
});
// ---- Dormant capped path (config only)
test('capped config (plus.ai_lookup_quota 200): 200th lookup (199 used) is AI, 201st (200 used) is the dormant path', async () => {
  assert.equal((await lookupCheck(db('plus', { lookups: 199 }, SEEDED, CAPPED))).mode, 'ai');
  assert.equal((await lookupCheck(db('plus', { lookups: 200 }, SEEDED, CAPPED))).mode, 'dictionary');
});
test('capped config (plus.lookup_hard_cap 500): 500th (499 used) passes, 501st (500 used) is refused 429 without upsell', async () => {
  assert.equal((await lookupCheck(db('plus', { lookups: 499 }, SEEDED, CAPPED))).mode, 'dictionary');
  const b = await limit429(lookupCheck(db('plus', { lookups: 500 }, SEEDED, CAPPED)));
  assert.equal(b.code, 'lookup_limit'); assert.equal(b.plan, 'plus'); assert.equal(b.limit, 200);
  for (const m of Object.values<string>(b.messages)) { assert.doesNotMatch(m, /Plus/); assert.doesNotMatch(m, /500/); }
});
test('capped config: dormant path serves the cached gloss without OpenAI and counts the lookup', async () => {
  const d = db('plus', { lookups: 250 }, SEEDED, CAPPED);
  const ai = new AiService(d) as any;
  ai.getClient = () => { throw new Error('OpenAI must not be called on the dormant path'); };
  ai.getPlatformAiSettings = async () => ({ ...defaultAiPlatformSettings(), enabled: true });
  ai.assertAiAvailable = async () => undefined;
  ai.userAiGate = async () => ({ band: 'adult' }); // wlive S7/AI-1 gate (user row) is not under test here
  const r = await ai.lookup('u', { token: 'running', sentence: 'She was running home.', sourceLang: 'en', targetLang: 'uz' });
  assert.equal(r.translation, 'yugurmoq'); assert.equal(r.contextualMeaning, null);
  assert.equal(d.calls.upserts, 1);
});
// ---- Plus quizzes (200)
test('plus quizzes: 200th quiz (199 used) is allowed', async () => { await quizCheck(db('plus', { quizzes: 199 })); });
test('plus quizzes: 201st quiz (200 used) is refused with 429 quiz_limit limit 200, no upsell', async () => {
  const b = await limit429(quizCheck(db('plus', { quizzes: 200 })));
  assert.equal(b.limit, 200); for (const m of Object.values<string>(b.messages)) assert.doesNotMatch(m, /Plus/);
});
// ---- Tashkent day boundary
test('Tashkent boundary: 23:59 and 00:00 Asia/Tashkent are different usage days; resetAt = next Tashkent midnight', async () => {
  const at2359 = new Date('2026-10-31T18:59:00.000Z'); // 23:59 Tashkent (UTC+5)
  const at0000 = new Date('2026-10-31T19:00:00.000Z'); // 00:00 Tashkent, Nov 1
  assert.equal(usageDayStart(at2359).toISOString(), '2026-10-31T00:00:00.000Z');
  assert.equal(usageDayStart(at0000).toISOString(), '2026-11-01T00:00:00.000Z');
  assert.equal(usageResetAt(at2359).toISOString(), '2026-10-31T19:00:00.000Z');
  assert.equal(usageResetAt(at0000).toISOString(), '2026-11-01T19:00:00.000Z');
  assert.equal(usageDayStart(new Date('2026-10-31T00:30:00.000Z')).toISOString(), '2026-10-31T00:00:00.000Z', '05:30 Tashkent');
});
test('429 body carries {statusCode 429, code, kind, limit, resetAt, messages}; UI line says 00:00', async () => {
  const b = await limit429(quizCheck(db('free', { quizzes: 10 })));
  assert.equal(b.statusCode, 429); assert.equal(b.resetAt, usageResetAt().toISOString());
  for (const k of ['code', 'kind', 'limit', 'resetAt', 'messages']) assert.ok(k in b, k);
  assert.equal(limitResetLine(b.resetAt, 'en'), 'Resets at 00:00 (Tashkent time).');
});
// ---- runtime config
test('caps come from platform_settings at runtime; an admin edit is picked up after the ≤60 s cache', async () => {
  const plans: Plans = { free: { ai: 20, quiz: 10 }, premium: { ai: 1, quiz: 200 } };
  const settings: Settings = {};
  const d = db('free', {}, plans, settings);
  const t0 = 1_000_000_000;
  assert.equal((await getPlanCaps(d, t0)).free.lookups, 20);
  plans.free = { ai: 30, quiz: 12 }; settings['plus.ai_lookup_quota'] = 300;
  assert.equal((await getPlanCaps(d, t0 + 1000)).free.lookups, 20, 'cached');
  const later = await getPlanCaps(d, t0 + PLAN_CAPS_TTL_MS + 1);
  assert.equal(later.free.lookups, 30); assert.equal(later.free.quizzes, 12); assert.equal(later.plus.lookups, 300);
  assert.ok(PLAN_CAPS_TTL_MS <= 60_000);
});
test('code defaults without the seed: Free 20/10, Plus lookups null (no daily limit) / 200 quizzes; never 50 or 1,000,000', async () => {
  assert.deepEqual(DAILY_CAP_FALLBACKS, { free: { lookups: 20, quizzes: 10, mashq: 20 }, plus: { lookups: null, quizzes: 200, mashq: null } });
  assert.equal(defaultAiPlatformSettings().defaultUserQuota, 20);
  assert.deepEqual(await getPlanCaps(db('free', {}, {}), 1), { free: { lookups: 20, quizzes: 10, mashq: 20 }, plus: { lookups: null, quizzes: 200, mashq: null }, plusLookupHardCap: null });
});
// ---- speed guard
test('speed guard: 30 lookups in a minute pass, the 31st gets a friendly 429 lookup_slow_down, is logged, and is not a ban', async () => {
  const ai = new AiService(db('plus', {})) as any;
  const warns: string[] = []; ai.logger = { warn: (m: string) => warns.push(m), log: () => undefined };
  const t = 2_000_000_000_000;
  assert.equal(LOOKUP_BURST_FALLBACKS.perMinute, 30);
  for (let i = 0; i < 30; i++) await ai.burstGuard('u', t + i);
  const b = await limit429(ai.burstGuard('u', t + 40));
  assert.equal(b.code, 'lookup_slow_down'); assert.deepEqual(b.messages, {
    en: "You're looking up words very quickly. Take a short pause and try again in a minute.",
    uz: 'So\u02BBzlarni juda tez qidiryapsiz. Biroz kutib, bir daqiqadan so\u02BBng qayta urinib ko\u02BBring.',
    ru: 'Вы ищете слова слишком быстро. Подождите немного и попробуйте снова через минуту.',
  });
  assert.equal(b.message, b.messages.en);
  for (const m of Object.values(b.messages) as string[]) assert.ok(!/unlimited|fair use/i.test(m));
  assert.ok(b.retryAfterSec > 0 && b.retryAfterSec <= 60);
  assert.equal(warns.length, 1); assert.match(warns[0], /"event":"lookup_burst"/);
  await ai.burstGuard('other-user', t + 41);
  await ai.burstGuard('u', t + 60_001); // window slid: allowed again, no ban
});
test('speed guard: per-hour ceiling from config (lookup.burst_per_hour)', async () => {
  const ai = new AiService(db('plus', {}, SEEDED, { 'lookup.burst_per_minute': 1000, 'lookup.burst_per_hour': 5 })) as any;
  ai.logger = { warn: () => undefined, log: () => undefined };
  const t = 2_000_000_000_000;
  for (let i = 0; i < 5; i++) await ai.burstGuard('u', t + i * 61_000);
  assert.equal((await limit429(ai.burstGuard('u', t + 6 * 61_000))).code, 'lookup_slow_down');
});
// ---- cost log
test('cost log: each lookup writes model, tokens, estimated cost, plan and cache hit', async () => {
  const d = db('plus', {});
  const ai = new AiService(d) as any;
  const lines: string[] = []; ai.logger = { warn: () => undefined, log: (m: string) => lines.push(m) };
  ai.useMemory = () => false;
  await ai.logLookupCost('u', { model: 'gpt-4o-mini', promptTokens: 1000, completionTokens: 500 }, false, 'ai');
  await ai.logLookupCost('u', {}, true, 'ai');
  const [a, c] = d.calls.costRows;
  assert.equal(a.model, 'gpt-4o-mini'); assert.equal(a.plan, 'plus'); assert.equal(a.cacheHit, false);
  assert.equal(a.promptTokens, 1000); assert.equal(a.completionTokens, 500); assert.equal(a.estCostUsd, 0.00045);
  assert.equal(c.cacheHit, true); assert.equal(c.estCostUsd, 0);
  assert.match(lines[0], /"event":"lookup_cost"/);
});
// ---- offer / copy
test('/billing/plus/offer limits come from config (Plus lookups null by default)', async () => {
  const svc = new ImportCommerceService(db('free', {}) as any, {} as any);
  assert.deepEqual(await svc.plusLimits(50), { plusLookups: null, freeLookups: 20, plusQuizzes: 200, freeQuizzes: 10, importDiscountPct: 50 });
});
test('paywall copy is Marketing §4 while uncapped; never says "unlimited"', async () => {
  assert.equal(plusHeadline(null, 'en'), 'No daily limit on word lookups with Plus.');
  assert.equal(plusHeadline(null, 'uz'), 'Plus bilan soʻz izohlarida kunlik cheklov yoʻq.');
  assert.equal(plusHeadline(null, 'ru'), 'С Plus нет дневного лимита на пояснения слов.');
  assert.equal(plusLookupsBullet(null, 20, 'en'), 'No daily limit on word lookups (20 a day on Free)');
  assert.equal(plusLead(null, 20, 'en'), "Free gives you 20 word lookups a day. Plus has no daily limit on word lookups, so a long chapter won't stop you halfway.");
  assert.equal(plusHeadline(200, 'en'), 'Look up 200 words a day with Plus.');
});

(async () => {
  for (const [name, fn] of tests) {
    resetPlanCapsCache();
    try { await fn(); console.log(`ok - ${name}`); } catch (e) { console.error(`not ok - ${name}`); throw e; }
  }
  console.log(`daily-caps: ${tests.length} passed`);
})().catch((e) => { console.error(e); process.exit(1); });
