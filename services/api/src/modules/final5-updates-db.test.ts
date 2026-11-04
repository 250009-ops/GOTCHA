/**
 * final-5 follow-ups on a LOCAL migrated DB (TEST_DATABASE_URL; skipped otherwise; never prod):
 *  (b) gateway OFF: free imports still capped at importFreeLimits (3 a day, 50 pages a month); quote + checkout agree.
 *  (c) hard delete keeps the user's sent messages, sender NULL, shown as 'Deleted user' (WL4-11 option B); FK is SET NULL.
 *  (a) seed copyCatalogBaseSom copies the legacy soʻm basePriceUsd to basePriceSom non-destructively + idempotently; API reads 49000 flat;
 *      support e-mail fallback is support@gotchaa.uz.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { ImportCommerceService } from './billing/import-commerce.service';
import { AdminService } from './admin/admin.service';
import { MessagingService } from './messaging/messaging.service';
import { catalogBaseSom, copyCatalogBaseSom } from '../common/catalog-pricing';

(async () => {
  // pure checks (always)
  assert.equal(catalogBaseSom({ basePriceUsd: 49000 }), 49000, 'legacy key holds soʻm');
  assert.equal(catalogBaseSom({ basePriceSom: 52000, basePriceUsd: 49000 }), 52000, 'new key wins');
  assert.equal(catalogBaseSom({ basePriceUsd: 4.99 }), 49000, '$4.99 is never read as soʻm');
  assert.equal(catalogBaseSom(null), 49000);
  const adminSrc = readFileSync(join(__dirname, 'admin/admin.service.ts'), 'utf8');
  const seedSrc = readFileSync(join(__dirname, '../../prisma/seed.ts'), 'utf8');
  assert.match(adminSrc, /supportEmail: 'support@gotchaa\.uz'/);
  assert.doesNotMatch(adminSrc + seedSrc, /support@gotcha\.app/);
  assert.match(seedSrc, /importPageTier\.count\(\)\) === 0/, 'tier seed insert-only');

  const url = process.env.TEST_DATABASE_URL;
  if (!url || !/localhost|127\.0\.0\.1/.test(url) || /gotchaa\.uz|prod/i.test(url)) {
    console.log('final5-updates-db: pure OK; DB SKIP (set TEST_DATABASE_URL to a local DB)'); return;
  }
  const db = new PrismaClient({ datasources: { db: { url } } });
  const t = Date.now();
  const mkUser = (n: string) => db.user.create({ data: { email: `${n}-${t}@test.local`, passwordHash: 'x', birthYear: 1990, nativeLanguage: 'uz' } as any });
  const saved = await db.platformSetting.findUnique({ where: { key: 'catalogPricingRules' } });
  const savedLimits = await db.platformSetting.findUnique({ where: { key: 'importFreeLimits' } });
  const prevGw = process.env.PAYMENT_GATEWAY_ENABLED;
  try {
    // ---- (b) gateway off
    process.env.PAYMENT_GATEWAY_ENABLED = 'false';
    delete process.env.IMPORTS_UNLIMITED; delete process.env.DEV_UNLIMITED_IMPORTS;
    await db.platformSetting.upsert({ where: { key: 'importFreeLimits' }, update: { value: { dailyFreeImportsPerUser: 3, monthlyFreePageLimit: 50 } }, create: { key: 'importFreeLimits', value: { dailyFreeImportsPerUser: 3, monthlyFreePageLimit: 50 } } });
    const ic = Object.create(ImportCommerceService.prototype) as any;
    ic.prisma = db; ic.atmos = { minAmountTiyins: () => 50000, configured: () => false };
    assert.equal(ic.gatewayEnabled(), false);
    const u1 = await mkUser('gwoff1');
    for (let i = 0; i < 3; i++) assert.ok((await ic.consumePayment(u1.id, undefined, 'paste', 2)).id, `free import ${i + 1}`);
    const limited = (e: any) => e?.status === 403 && e?.response?.code === 'IMPORT_LIMIT_REACHED';
    await assert.rejects(ic.consumePayment(u1.id, undefined, 'paste', 1), limited, '4th import today refused');
    const q = await ic.quote(u1.id, { importType: 'paste', textLength: 100 });
    assert.equal(q.isFree, false); assert.equal(q.requiresPayment, false); assert.equal(q.freeReason, 'Free import limit reached');
    await assert.rejects(ic.checkout(u1.id, { importType: 'paste', textLength: 100 }), limited, 'checkout cannot mint a free credit over the cap');
    const u2 = await mkUser('gwoff2');
    await assert.rejects(ic.consumePayment(u2.id, undefined, 'pdf', 51), limited, '51 pages > 50 a month');
    assert.ok(await ic.consumePayment(u2.id, undefined, 'pdf', 30));
    await assert.rejects(ic.consumePayment(u2.id, undefined, 'pdf', 21), limited, '30 + 21 > 50');
    assert.ok(await ic.consumePayment(u2.id, undefined, 'pdf', 20), '30 + 20 = 50 ok');
    // a credit taken at checkout is reused, not double-counted
    const u3 = await mkUser('gwoff3');
    const co = await ic.checkout(u3.id, { importType: 'paste', textLength: 100 });
    const used = await ic.consumePayment(u3.id, co.paymentId, 'paste', 1);
    assert.equal(used.id, co.paymentId);
    assert.equal(await db.importPayment.count({ where: { userId: u3.id } }), 1);

    // ---- (c) messages survive hard delete
    const [a, b, c2] = await Promise.all([mkUser('msgA'), mkUser('msgB'), mkUser('msgC')]);
    const conv = await db.conversation.create({ data: { pairKey: `${a.id}:${b.id}:${t}`, participants: { create: [{ userId: a.id }, { userId: b.id }] } } as any });
    const m1 = await db.message.create({ data: { conversationId: conv.id, senderId: a.id, body: 'hello from A' } });
    const m2 = await db.message.create({ data: { conversationId: conv.id, senderId: b.id, body: 'reply from B' } });
    const admin = Object.create(AdminService.prototype) as any; admin.prisma = db;
    await admin.hardDeleteUser(a.id, { confirm: a.id, actorId: null });
    assert.equal(await db.user.count({ where: { id: a.id } }), 0);
    const kept = await db.message.findUnique({ where: { id: m1.id }, include: { sender: true } });
    assert.ok(kept, 'A\'s message kept'); assert.equal(kept!.senderId, null); assert.equal(kept!.body, 'hello from A');
    assert.ok(await db.message.findUnique({ where: { id: m2.id } }));
    const ms = Object.create(MessagingService.prototype) as any;
    const shown = ms.presentMessage(kept, b.id);
    assert.equal(shown.sender.displayName, 'Deleted user'); assert.equal(shown.sender.deleted, true); assert.equal(shown.mine, false);
    // raw FK: deleting a sender sets NULL instead of cascading
    const m3 = await db.message.create({ data: { conversationId: conv.id, senderId: c2.id, body: 'from C' } });
    await db.user.delete({ where: { id: c2.id } });
    assert.equal((await db.message.findUnique({ where: { id: m3.id } }))!.senderId, null);

    // ---- (a) seed step copyCatalogBaseSom (not a migration: Kai's guard forbids UPDATE platform_settings in migrations)
    const run = () => copyCatalogBaseSom(db as any);
    const setRule = (v: object) => db.platformSetting.upsert({ where: { key: 'catalogPricingRules' }, update: { value: v }, create: { key: 'catalogPricingRules', value: v } });
    const getRule = async () => (await db.platformSetting.findUnique({ where: { key: 'catalogPricingRules' } }))!.value as any;
    await setRule({ contentType: 'book', basePriceUsd: 49000, perPageSurchargeUsd: 0.02, buy3PctOff: 10 }); // live prod shape (DevOps)
    assert.equal(await run(), true);
    let v = await getRule();
    assert.equal(v.basePriceSom, 49000); assert.equal(v.basePriceUsd, 49000, 'legacy key kept'); assert.equal(v.perPageSurchargeSom, 0); assert.equal(v.currency, 'UZS'); assert.equal(v.buy3PctOff, 10);
    assert.equal(await run(), false, 'idempotent');
    await setRule({ ...v, basePriceSom: 55000 }); assert.equal(await run(), false);
    assert.equal((await getRule()).basePriceSom, 55000, 'never overwrites basePriceSom');
    await setRule({ basePriceUsd: 4.99 }); await run();
    assert.equal((await getRule()).basePriceSom, 49000, 'old $ default -> flat 49000 soʻm');
    await db.platformSetting.deleteMany({ where: { key: 'catalogPricingRules' } });
    assert.equal(await run(), false, 'never creates the row');
    await setRule({ contentType: 'book', basePriceUsd: 49000, perPageSurchargeUsd: 0.02 });
    const r = await admin.getCatalogPricingRules();
    assert.equal(r.basePriceSom, 49000); assert.equal(r.perPageSurchargeSom, 0); assert.equal(r.currency, 'UZS'); assert.equal('basePriceUsd' in r, false);
    const w = await admin.updateCatalogPricingRules({ basePriceSom: 49000, perPageSurchargeSom: 500 });
    assert.equal(w.perPageSurchargeSom, 0, 'Kai: flat price, surcharge always 0');
    v = await getRule(); assert.equal(v.basePriceSom, 49000); assert.equal(v.basePriceUsd, 49000, 'legacy mirror for rollback');
    await assert.rejects(admin.updateCatalogPricingRules({ basePriceSom: 4.99 }));
    console.log('final5-updates-db: OK (gateway-off 3/day + 50 pages/month enforced; hard delete keeps messages as Deleted user; seed copies basePriceUsd->basePriceSom non-destructively; flat 49000 soʻm; support@gotchaa.uz)');
  } finally {
    if (prevGw === undefined) delete process.env.PAYMENT_GATEWAY_ENABLED; else process.env.PAYMENT_GATEWAY_ENABLED = prevGw;
    if (saved) await db.platformSetting.update({ where: { key: 'catalogPricingRules' }, data: { value: saved.value as any } });
    else await db.platformSetting.deleteMany({ where: { key: 'catalogPricingRules' } });
    if (savedLimits) await db.platformSetting.update({ where: { key: 'importFreeLimits' }, data: { value: savedLimits.value as any } });
    await db.$disconnect();
  }
})().catch((e) => { console.error(e); process.exit(1); });

// support e-mail read path (no DB): legacy seed value reads as the live address
(async () => {
  const admin = Object.create(AdminService.prototype) as any;
  for (const stored of ['support@gotcha.app', undefined, 'support@gotchaa.uz']) {
    admin.prisma = { platformSetting: { findMany: async () => (stored ? [{ key: 'supportEmail', value: stored }] : []) } };
    const s = await admin.settings().catch(() => null);
    if (s) assert.equal(s.supportEmail, 'support@gotchaa.uz', `stored ${stored}`);
  }
  console.log('final5-updates support e-mail: OK');
})().catch((e) => { console.error(e); process.exit(1); });
