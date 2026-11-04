/** final-6: per-user payment-creation limit 5/min + 20/h → 429 payment_rate_limited (DB-backed, cross-process). */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { ImportCommerceService, PAY_CREATE_FALLBACKS } from './import-commerce.service';

const url = process.env.TEST_DATABASE_URL;
(async () => {
  assert.deepEqual(PAY_CREATE_FALLBACKS, { perMinute: 5, perHour: 20 });
  const src = require('node:fs').readFileSync(__dirname + '/import-commerce.service.ts', 'utf8') as string;
  assert.equal((src.match(/await this\.assertPayCreateRate\(userId\);[^\n]*\r?\n\s+const (atmosTx|created) = await this\.atmos\.createTransaction\(/g) ?? []).length, 3, 'every Atmos create is rate limited');
  if (!url) { console.log('pay-create-rate: static OK (no TEST_DATABASE_URL, DB part skipped)'); return; }
  const db = new PrismaClient({ datasources: { db: { url } } });
  try {
    const u = await db.user.create({ data: { email: `payrate-${Date.now()}@test.local`, passwordHash: 'x', nativeLanguage: 'uz' } as any });
    const s = Object.create(ImportCommerceService.prototype) as any; s.prisma = db; s.logger = { warn: () => undefined };
    const mk = (agoMs: number) => db.importPayment.create({ data: { userId: u.id, account: `pr_${randomUUID().slice(0, 12)}`, amountTiyins: 2499000, currency: 'UZS', estimatedPages: 1, contentFormat: 'article', importType: 'paste' as any, status: 'pending' as any, provider: 'atmos', providerPaymentId: String(Math.floor(Math.random() * 1e9)), createdAt: new Date(Date.now() - agoMs) } as any });
    for (let i = 0; i < 4; i++) await mk(1000);
    await s.assertPayCreateRate(u.id); // 4 in the last minute: allowed
    await mk(1000);
    const e: any = await s.assertPayCreateRate(u.id).catch((x: any) => x);
    assert.equal(e?.getStatus?.(), 429); assert.equal(e.getResponse().code, 'payment_rate_limited'); assert.equal(e.getResponse().window, 'minute');
    await db.importPayment.updateMany({ where: { userId: u.id }, data: { createdAt: new Date(Date.now() - 120_000) } });
    await s.assertPayCreateRate(u.id); // minute window slid
    for (let i = 0; i < 15; i++) await mk(600_000);
    const h: any = await s.assertPayCreateRate(u.id).catch((x: any) => x);
    assert.equal(h.getResponse().window, 'hour');
    await db.importPayment.deleteMany({ where: { userId: u.id } }); await db.user.delete({ where: { id: u.id } });
    console.log('pay-create-rate: OK (6th create in a minute → 429 payment_rate_limited; 21st in an hour → 429; window slides)');
  } finally { await db.$disconnect(); }
})().catch((e) => { console.error(e); process.exit(1); });
