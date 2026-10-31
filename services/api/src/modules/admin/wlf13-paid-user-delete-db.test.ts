/**
 * round-3b WLF-13 (S2): an admin hard delete NEVER deletes payment records. On a LOCAL migrated DB (TEST_DATABASE_URL;
 * skipped otherwise; never prod): a user who paid (paid import payment + Plus entitlement + catalog purchase) is
 * anonymised + purged, the payment rows survive and still point at the anonymised row; a raw DELETE of that user is
 * refused by the FK (RESTRICT, not CASCADE); a user who never paid is still really deleted.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { AdminService } from './admin.service';

const schema = readFileSync(join(__dirname, '../../../prisma/schema.prisma'), 'utf8').replace(/\r/g, '');
for (const m of ['ImportPayment', 'Entitlement', 'PlayPurchase', 'ContentPurchase']) {
  const body = schema.slice(schema.indexOf(`model ${m} {`)).split('\n}')[0];
  const userRel = body.split('\n').find((l) => /^\s+user\s+User\??\s+@relation/.test(l)) ?? '';
  assert.ok(/onDelete: (Restrict|SetNull)/.test(userRel), `${m}.user must be RESTRICT / SET NULL, never CASCADE: ${userRel}`);
}

(async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !/localhost|127\.0\.0\.1/.test(url) || /gotchaa\.uz|prod/i.test(url)) {
    console.log('wlf13-paid-user-delete-db: schema OK; DB SKIP (set TEST_DATABASE_URL to a local DB)'); return;
  }
  const db = new PrismaClient({ datasources: { db: { url } } });
  const t = Date.now();
  const mkUser = (n: string) => db.user.create({ data: { email: `${n}-${t}@test.local`, passwordHash: 'x', birthYear: 1990, nativeLanguage: 'uz', displayName: n } as any });
  try {
    const payer = await mkUser('payer');
    const pay = await db.importPayment.create({ data: { userId: payer.id, account: `wlf13_${randomUUID().slice(0, 12)}`, amountTiyins: 2499000, currency: 'UZS', estimatedPages: 0, contentFormat: 'plus_pass:30', importType: 'paste' as any, status: 'paid' as any, provider: 'atmos', providerPaymentId: String(t), paidAt: new Date() } as any });
    const ent = await db.entitlement.create({ data: { userId: payer.id, kind: 'plus' as any, source: 'atmos' as any, sourceRef: pay.id, importPaymentId: pay.id } as any });
    await db.aiUsageDaily.create({ data: { userId: payer.id, usageDate: new Date(), lookupCount: 3 } as any });
    const never = await mkUser('neverpaid');

    // the FK itself refuses a raw delete of a payer (RESTRICT): no cascade, whatever code path deletes
    await assert.rejects(() => db.user.delete({ where: { id: payer.id } }), /Foreign key|foreign key|P2003|violates/);

    const admin = Object.create(AdminService.prototype) as any; admin.prisma = db;
    const res = await admin.hardDeleteUser(payer.id, { confirm: payer.id, actorId: null });
    assert.equal(res.deleted, false); assert.equal(res.anonymised, true); assert.ok(res.paymentRecordsKept >= 2, JSON.stringify(res));
    const p2 = await db.importPayment.findUnique({ where: { id: pay.id } });
    assert.ok(p2, 'paid import payment kept'); assert.equal(p2!.status, 'paid'); assert.equal(p2!.userId, payer.id);
    assert.ok(await db.entitlement.findUnique({ where: { id: ent.id } }), 'entitlement kept');
    const u = await db.user.findUnique({ where: { id: payer.id } });
    assert.equal(u!.email, `deleted-${payer.id}@deleted.gotcha.app`); assert.equal(u!.displayName, 'Deleted user');
    assert.equal(u!.passwordHash, null); assert.ok(u!.deletedAt);
    assert.equal(await db.aiUsageDaily.count({ where: { userId: payer.id } }), 0, 'personal data purged');

    const res2 = await admin.hardDeleteUser(never.id, { confirm: never.id, actorId: null });
    assert.deepEqual(res2, { deleted: true, id: never.id });
    assert.equal(await db.user.count({ where: { id: never.id } }), 0, 'a non-payer is really deleted');
    console.log('wlf13-paid-user-delete-db: OK (payer anonymised, import payment + entitlement kept, raw delete refused by RESTRICT FK; non-payer deleted)');
  } finally {
    await db.$disconnect();
  }
})().catch((e) => { console.error(e); process.exit(1); });
