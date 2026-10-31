/**
 * final-6.1b unit tests (no DB): free counters skip failed imports, Tashkent windows, resetCycle only
 * governs pages; worker stop() releases in-flight jobs; drain env parsing; worker.ts owns SIGTERM.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ImportCommerceService } from '../billing/import-commerce.service';
import { ImportWorker, importWorkerDrainMs } from './import-worker';

type Pay = { estimatedPages: number; paidAt: Date; userImportId: string | null; amountTiyins?: number; status?: string };
function commerce(pays: Pay[], failedIds: string[]) {
  const s = Object.create(ImportCommerceService.prototype) as any;
  s.prisma = {
    importPayment: {
      findMany: async ({ where }: any) =>
        pays.filter((p) => (p.amountTiyins ?? 0) === 0 && (p.status ?? 'paid') === 'paid' && p.paidAt >= where.paidAt.gte),
    },
    userImport: { findMany: async ({ where }: any) => where.id.in.filter((id: string) => failedIds.includes(id)).map((id: string) => ({ id })) },
  };
  return s;
}

(async () => {
  const now = Date.now();
  const tDayStart = (Object.create(ImportCommerceService.prototype) as any).startOfTashkentDay() as Date;
  const tMonthStart = (Object.create(ImportCommerceService.prototype) as any).startOfTashkentMonth() as Date;
  const today = new Date(Math.max(tDayStart.getTime() + 1000, now - 1000));
  const yesterday = new Date(tDayStart.getTime() - 3600_000);
  const lastMonth = new Date(tMonthStart.getTime() - 3600_000);
  const pays: Pay[] = [
    { estimatedPages: 10, paidAt: today, userImportId: 'ok1' },
    { estimatedPages: 20, paidAt: today, userImportId: 'failed1' }, // failed → not counted at all
    { estimatedPages: 5, paidAt: today, userImportId: 'ok2' },
    { estimatedPages: 7, paidAt: today, userImportId: 'paid1', amountTiyins: 500000 }, // paid import → not a free slot
    { estimatedPages: 40, paidAt: lastMonth, userImportId: 'old' }, // previous month window
  ];
  if (yesterday >= tMonthStart) pays.push({ estimatedPages: 3, paidAt: yesterday, userImportId: 'y1' });
  const u = await commerce(pays, ['failed1']).freeUsage('u', 'monthly');
  assert.equal(u.dailyFreeUsed, 2, 'failed free import does not use one of the 3 daily imports');
  assert.equal(u.monthlyPagesUsed, 15 + (yesterday >= tMonthStart ? 3 : 0), 'failed free import does not use pages; last month excluded');
  // resetCycle never shrinks/widens the DAILY import count
  const y = await commerce(pays, ['failed1']).freeUsage('u', 'yearly');
  assert.equal(y.dailyFreeUsed, 2);
  assert.ok(y.monthlyPagesUsed >= u.monthlyPagesUsed, 'yearly page window includes the monthly one');
  // a user retry (status back to queued) counts again
  assert.equal((await commerce(pays, []).freeUsage('u', 'monthly')).dailyFreeUsed, 3);
  // getFreeLimits: stale 'daily' resetCycle → monthly page window; defaults 3/day, 50 pages
  const g = Object.create(ImportCommerceService.prototype) as any;
  g.prisma = { platformSetting: { findUnique: async () => ({ value: { resetCycle: 'daily' } }) } };
  const lim = await g.getFreeLimits();
  assert.equal(lim.resetCycle, 'monthly'); assert.equal(lim.dailyFreeImportsPerUser, 3); assert.equal(lim.monthlyFreePageLimit, 50);

  // drain parsing
  assert.equal(importWorkerDrainMs({}), 20_000);
  assert.equal(importWorkerDrainMs({ IMPORT_WORKER_DRAIN_MS: '5000' }), 5000);
  assert.equal(importWorkerDrainMs({ IMPORT_WORKER_DRAIN_MS: 'x' }), 20_000);
  assert.equal(importWorkerDrainMs({ IMPORT_WORKER_DRAIN_MS: '999999' }), 120_000);

  // stop(): a job still running after the drain window is released (fenced on locked_by), not failed
  const released: string[] = [];
  const prisma: any = {
    $executeRaw: async (q: TemplateStringsArray, ...v: unknown[]) => {
      if (q.join('?').includes("SET status = 'queued', attempts = GREATEST(0, attempts - 1)")) { released.push(String(v[0])); return 1; }
      return 0;
    },
    $queryRaw: async () => [],
  };
  const w = new ImportWorker(prisma, {} as any);
  (w as any).inFlight.add('job-1'); (w as any).running = 1;
  const r = await w.stop(10);
  assert.deepEqual(r.released, ['job-1']); assert.deepEqual(released, ['job-1']);
  assert.equal((w as any).stopping, true);

  // worker.ts handles SIGTERM itself (stop before Prisma disconnect), not via enableShutdownHooks
  const src = readFileSync(join(__dirname, '../../worker.ts'), 'utf8');
  assert.match(src, /process\.once\('SIGTERM'/);
  assert.ok(!/enableShutdownHooks\(\)/.test(src.replace(/\/\*[\s\S]*?\*\//g, '')), 'no Nest shutdown hooks in worker');
  assert.ok(src.indexOf('worker.stop()') < src.indexOf('app.close()'));
  console.log('f61b-worker.test: OK');
})().catch((e) => { console.error(e); process.exit(1); });
