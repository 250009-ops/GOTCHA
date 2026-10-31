/**
 * final-5 guard (DevOps halt 31 Oct): migrate deploy on a prod-shaped DB (prod is at 0016_user_best_streak) must not
 * change any plan row (price, tier, name, limits) or importFreeLimits (3/day, 50 pages/month).
 * Static part always runs: no migration SQL contains 34990, sets a price to 9, or UPDATEs subscription_plans / platform_settings,
 * and 0020 seeds with ON CONFLICT DO NOTHING. DB part needs TEST_DATABASE_URL (throwaway; creates + drops its own DB).
 */
import { execSync } from 'node:child_process';
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';

const root = join(__dirname, '../..');
const migDir = join(root, 'prisma/migrations');
const migs = readdirSync(migDir).filter((d) => /^\d{4}_/.test(d)).sort();
for (const m of migs) {
  const sql = readFileSync(join(migDir, m, 'migration.sql'), 'utf8');
  assert.ok(!/34990/.test(sql), `${m}: contains 34990`);
  assert.ok(!/price(_monthly|_uzs)?"?\s*=\s*'?9(\.0+)?'?\b/i.test(sql), `${m}: sets a price to 9`);
  assert.ok(!/UPDATE\s+"?(subscription_plans|platform_settings)"?/i.test(sql), `${m}: updates plan rows or platform settings`);
  assert.ok(!/ON CONFLICT\s*\("?tier"?\)\s*DO UPDATE/i.test(sql), `${m}: upserts plan rows`);
}
assert.match(readFileSync(join(migDir, '0020_pricing/migration.sql'), 'utf8'), /ON CONFLICT \("tier"\) DO NOTHING/);
console.log(`prod-shaped-migrate.test: static OK (${migs.length} migrations)`);

const base = process.env.TEST_DATABASE_URL;
if (!base) { console.log('prod-shaped-migrate.test: DB part SKIP (no TEST_DATABASE_URL)'); process.exit(0); }

const PROD_HEAD = '0016_user_best_streak';
const name = `prodshape_${Date.now()}`;
const url = base.replace(/\/[^/?]+(\?|$)/, `/${name}$1`);
const sh = (cmd: string, cwd = root, input?: string) =>
  execSync(cmd, { cwd, input, stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, DATABASE_URL: url } }).toString();
const tmp = mkdtempSync(join(tmpdir(), 'prodshape-'));
sh(`npx prisma db execute --url "${base}" --stdin`, root, `CREATE DATABASE "${name}";`);
(async () => {
  const db = new PrismaClient({ datasources: { db: { url } } });
  try {
    cpSync(join(root, 'prisma/schema.prisma'), join(tmp, 'schema.prisma'));
    for (const m of migs.filter((m) => m <= PROD_HEAD)) cpSync(join(migDir, m), join(tmp, 'migrations', m), { recursive: true });
    cpSync(join(migDir, 'migration_lock.toml'), join(tmp, 'migrations/migration_lock.toml'));
    sh(`npx prisma migrate deploy --schema "${join(tmp, 'schema.prisma')}"`);
    // Prod rows as reported by DevOps (31 Oct): legacy columns only.
    await db.$executeRawUnsafe(`DELETE FROM subscription_plans`);
    await db.$executeRawUnsafe(`INSERT INTO subscription_plans (id,tier,name,price_monthly,ai_daily_quota,import_limit,offline_enabled) VALUES
      (gen_random_uuid(),'free','Free',0,5000,100,false),(gen_random_uuid(),'premium','Premium',9.00,1000000,1000000,false)`);
    await db.$executeRawUnsafe(`INSERT INTO platform_settings (key,value,updated_at) VALUES ('importFreeLimits',
      '{"dailyFreeImportsPerUser":3,"monthlyFreePageLimit":50,"allowedFormats":["article","news"],"resetCycle":"monthly","allowRollover":true}', now())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`);
    // L1 (S1): live Free lookup cap is 5000 via aiDefaultUserQuota / ai_daily_quota; no caps.* keys exist on prod.
    await db.$executeRawUnsafe(`INSERT INTO platform_settings (key,value,updated_at) VALUES ('aiDefaultUserQuota','5000', now()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`);
    // Prod-shaped bogus page tiers (DevOps 31 Oct): the 0020 seed must leave them alone (fixed only by the data-fix).
    await db.$executeRawUnsafe(`DELETE FROM import_page_tiers`);
    await db.$executeRawUnsafe(`INSERT INTO import_page_tiers (id,label,min_pages,max_pages,price_usd,sort_order,updated_at) VALUES
      (gen_random_uuid(),'1 - 100 pages',1,40,12000,1,now()),(gen_random_uuid(),'1 - 100 pages',1,100,29000,2,now()),(gen_random_uuid(),'901 - 1500 pages',901,1500,0,3,now())`);
    const snap = async () => ({
      plans: await db.$queryRawUnsafe<any[]>(`SELECT tier::text, name, price_monthly::text AS price, ai_daily_quota, import_limit, offline_enabled FROM subscription_plans ORDER BY tier`),
      settings: await db.$queryRawUnsafe<any[]>(`SELECT key, value::text AS value FROM platform_settings ORDER BY key`),
      tiers: await db.$queryRawUnsafe<any[]>(`SELECT label, min_pages, max_pages, price_usd::text AS price FROM import_page_tiers ORDER BY sort_order, min_pages`),
    });
    const before = await snap();
    const out = sh(`npx prisma migrate deploy`);
    const applied = (await db.$queryRawUnsafe<any[]>(`SELECT migration_name FROM _prisma_migrations WHERE migration_name > '${PROD_HEAD}' ORDER BY 1`)).map((r) => r.migration_name);
    assert.deepEqual(applied, migs.filter((m) => m > PROD_HEAD), out);
    const after = await snap();
    assert.deepEqual(after.plans, before.plans, 'plan rows changed');
    assert.deepEqual(after.settings, before.settings, 'platform_settings changed');
    const ifl = JSON.parse(after.settings.find((s) => s.key === 'importFreeLimits').value);
    assert.equal(ifl.dailyFreeImportsPerUser, 3); assert.equal(ifl.monthlyFreePageLimit, 50);
    assert.equal((await db.$queryRawUnsafe<any[]>(`SELECT count(*)::int AS n FROM store_products WHERE price_uzs = 34990`))[0].n, 0);
    assert.deepEqual(after.tiers, before.tiers, 'live page tiers must not be overwritten or deleted by migrations');

    // L1: enforced Free lookup cap is 20 on this DB (no caps.free.lookups; aiDefaultUserQuota + ai_daily_quota = 5000).
    const { AiService } = await import('../modules/ai/ai.service');
    const { resetPlanLimitsCache } = await import('./plan-limits');
    resetPlanLimitsCache();
    delete process.env.FREE_LOOKUPS_PER_DAY;
    const user = await db.user.create({ data: { email: `l1-${Date.now()}@test.local`, passwordHash: 'x', nativeLanguage: 'uz' } as any });
    const free = (await db.subscriptionPlan.findUnique({ where: { tier: 'free' } }))!;
    await db.userSubscription.create({ data: { userId: user.id, planId: free.id, status: 'active' } });
    const ai = Object.create(AiService.prototype) as any; ai.prisma = db; ai.useMemory = () => false;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    await db.aiUsageDaily.create({ data: { userId: user.id, usageDate: today, lookupCount: 19 } as any });
    const ok = await ai.checkQuota(user.id, 5000);
    assert.equal(ok.quota, 20, 'Free cap must be 20, not 5000');
    await db.aiUsageDaily.update({ where: { userId_usageDate: { userId: user.id, usageDate: today } }, data: { lookupCount: 20 } });
    await assert.rejects(() => ai.checkQuota(user.id, 5000), (e: any) => ['DAILY_LIMIT_REACHED', 'lookup_limit'].includes(e.response?.code) && e.response.limit === 20); // r3b: payments-02 body (lookup_limit, 429)
    // memory mode also ignores aiDefaultUserQuota
    const mem = Object.create(AiService.prototype) as any; mem.prisma = db; mem.useMemory = () => true; mem.memoryUsage = new Map();
    assert.equal((await mem.checkQuota(user.id, 5000)).quota, 20);
    console.log('prod-shaped-migrate.test: L1 OK (Free lookup cap enforced at 20 with aiDefaultUserQuota/ai_daily_quota = 5000; tiers untouched)');
    console.log(`prod-shaped-migrate.test: DB OK (applied ${applied.length}: ${applied[0]}..${applied.at(-1)}; plans + settings unchanged)`);
  } finally {
    await db.$disconnect();
    rmSync(tmp, { recursive: true, force: true });
    sh(`npx prisma db execute --url "${base}" --stdin`, root, `DROP DATABASE IF EXISTS "${name}" WITH (FORCE);`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
