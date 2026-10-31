/** Privacy §8: closed reports purged ~1 year after close; open / recent / no-reviewedAt kept; idempotent. Unit + optional local DB. */
import * as assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { closedBefore, purgeClosedReports, reportRetentionDays } from './report-retention';

async function main() {
  assert.equal(reportRetentionDays({}), 365);
  assert.equal(reportRetentionDays({ REPORT_RETENTION_DAYS: '30' }), 30);
  assert.equal(reportRetentionDays({ REPORT_RETENTION_DAYS: '0' }), 0);
  assert.equal(reportRetentionDays({ REPORT_RETENTION_DAYS: 'x' }), 365);
  const w = closedBefore(new Date(0)) as { status: { in: string[] }; reviewedAt: { not: null } };
  assert.deepEqual(w.status.in, ['reviewed', 'actioned', 'dismissed']);
  assert.equal(w.reviewedAt.not, null);
  const noop = await purgeClosedReports({ userReport: { deleteMany: async () => { throw new Error('must not run'); } }, contentReport: { deleteMany: async () => ({ count: 0 }) } }, 0);
  assert.equal(noop.userReports, 0);
  console.log('report-retention unit: OK');

  const url = process.env.TEST_DATABASE_URL;
  if (!url || !/localhost|127\.0\.0\.1|host=\/tmp/.test(url) || /gotchaa\.uz|prod/i.test(url)) {
    console.log('report-retention DB: SKIP (set TEST_DATABASE_URL to a local DB)');
    return;
  }
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  const day = 86_400_000;
  const now = Date.now();
  const mk = (status: string, reviewedAgo: number | null) =>
    prisma.userReport.create({ data: { reason: 'spam' as never, details: `rr-${now}`, status: status as never, reviewedAt: reviewedAgo == null ? null : new Date(now - reviewedAgo * day) } });
  const mkc = (status: string, reviewedAgo: number | null) =>
    prisma.contentReport.create({ data: { reason: 'spam' as never, details: `rr-${now}`, status: status as never, reviewedAt: reviewedAgo == null ? null : new Date(now - reviewedAgo * day) } });
  try {
    const old = [await mk('dismissed', 400), await mk('actioned', 366), await mkc('reviewed', 500)];
    const keep = [await mk('open', null), await mk('open', 400), await mk('reviewed', 100), await mk('dismissed', null), await mkc('reviewed', 30)];
    const r1 = await purgeClosedReports(prisma, 365, now);
    assert.ok(r1.userReports >= 2 && r1.contentReports >= 1, JSON.stringify(r1));
    for (const o of old.slice(0, 2)) assert.equal(await prisma.userReport.count({ where: { id: o.id } }), 0);
    assert.equal(await prisma.contentReport.count({ where: { id: old[2].id } }), 0);
    for (const k of keep.slice(0, 4)) assert.equal(await prisma.userReport.count({ where: { id: k.id } }), 1, 'kept');
    assert.equal(await prisma.contentReport.count({ where: { id: keep[4].id } }), 1);
    const r2 = await purgeClosedReports(prisma, 365, now);
    assert.deepEqual([r2.userReports, r2.contentReports], [0, 0], 'idempotent');
    console.log('report-retention DB: OK');
  } finally {
    await prisma.userReport.deleteMany({ where: { details: `rr-${now}` } });
    await prisma.contentReport.deleteMany({ where: { details: `rr-${now}` } });
    await prisma.$disconnect();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
