// payments-02: enforced limits (lookups/quizzes, Plus vs Free), offer numbers from config, import money-safety.
import * as assert from 'node:assert/strict';
import { ImportCommerceService, MAX_FREE_IMPORT_RETRIES } from './import-commerce.service';

(async () => {
  // Daily caps (lookups/quizzes, offer numbers) moved to src/common/daily-caps.test.ts (14:18/14:24 limits).
  // --- import money-safety
  type P = { id: string; userImportId: string | null; status: string; importAttempts: number; refundDue: boolean; needsAttention: boolean; paidAt: Date };
  const pays: P[] = [];
  const imps = new Map<string, string>();
  const match = (p: any, w: any) => Object.entries(w).every(([k, v]: any) => v && typeof v === 'object' && 'not' in v ? p[k] !== v.not : p[k] === v);
  const db: any = {
    importPayment: {
      findFirst: async ({ where }: any) => pays.find((p) => match(p, where)) ?? null,
      findMany: async ({ where }: any) => pays.filter((p) => match(p, where)),
      updateMany: async ({ where, data }: any) => {
        const hit = pays.filter((p) => match(p, where));
        for (const p of hit) for (const [k, v] of Object.entries<any>(data)) (p as any)[k] = v && typeof v === 'object' && 'increment' in v ? (p as any)[k] + v.increment : v;
        return { count: hit.length };
      },
    },
    userImport: {
      findUnique: async ({ where }: any) => (imps.has(where.id) ? { ingestionStatus: imps.get(where.id) } : null),
      findMany: async ({ where }: any) => [...imps].filter(([id, st]) => where.id.in.includes(id) && st === where.ingestionStatus).map(([id]) => ({ id })),
    },
  };
  const svc = new ImportCommerceService(db, {} as any);
  pays.push({ id: 'p1', userImportId: 'i1', status: 'paid', importAttempts: 0, refundDue: false, needsAttention: false, paidAt: new Date() });

  imps.set('i1', 'processing');
  assert.equal(await svc.settleFailedImport('i1'), null, 'running import is left alone');
  imps.set('i1', 'failed');
  assert.equal(await svc.settleFailedImport('i1'), 'retry', 'failed paid import → free retry');
  assert.equal(pays[0].userImportId, null, 'same payment is consumable again (no new charge)');
  assert.equal(pays[0].importAttempts, 1);
  assert.equal(pays[0].status, 'paid');
  assert.equal(await svc.settleFailedImport('i1'), null, 'idempotent: second call is a no-op');
  assert.equal(pays[0].importAttempts, 1);

  // retries used up → refund-due for admin (reverse path), once
  for (let n = 2; n <= MAX_FREE_IMPORT_RETRIES; n++) { pays[0].userImportId = `i${n}`; imps.set(`i${n}`, 'failed'); assert.equal(await svc.settleFailedImport(`i${n}`), 'retry'); }
  pays[0].userImportId = 'iX'; imps.set('iX', 'failed');
  assert.equal(await svc.settleFailedImport('iX'), 'refund_due');
  assert.equal(pays[0].refundDue, true); assert.equal(pays[0].needsAttention, true);
  assert.equal(pays[0].userImportId, 'iX', 'stays attached: no further free retry');
  assert.equal(await svc.settleFailedImport('iX'), null, 'refund-due flagged once');

  // sweep (start-up + interval): stuck/lost imports already marked failed by the watchdog get settled
  pays.push({ id: 'p2', userImportId: 'j1', status: 'paid', importAttempts: 0, refundDue: false, needsAttention: false, paidAt: new Date() });
  pays.push({ id: 'p3', userImportId: 'j2', status: 'paid', importAttempts: 0, refundDue: false, needsAttention: false, paidAt: new Date() });
  imps.set('j1', 'failed'); imps.set('j2', 'ready');
  assert.deepEqual(await svc.settleFailedImports(), { retry: 1, refundDue: 0 });
  assert.equal(pays[1].userImportId, null); assert.equal(pays[2].userImportId, 'j2', 'successful import untouched');
  assert.deepEqual(await svc.settleFailedImports(), { retry: 0, refundDue: 0 }, 'sweep idempotent');

  // import-p0 coordination (14:18): imports owned by import_queue_jobs are left to the queue's own refund logic.
  pays.push({ id: 'p4', userImportId: 'k1', status: 'paid', importAttempts: 0, refundDue: false, needsAttention: false, paidAt: new Date() });
  imps.set('k1', 'failed');
  let tablePresent = true;
  db.$queryRaw = async (q: TemplateStringsArray) => (q.join('?').includes('to_regclass') ? [{ present: tablePresent }] : tablePresent ? [{ id: 'k1' }] : []);
  assert.deepEqual(await svc.settleFailedImports(), { retry: 0, refundDue: 0 }, 'queue-owned failed import skipped by the sweep');
  assert.equal(await svc.settleFailedImport('k1'), null, 'queue-owned import skipped by settleFailedImport');
  assert.equal(pays[3].userImportId, 'k1');
  tablePresent = false;
  assert.deepEqual(await svc.settleFailedImports(), { retry: 1, refundDue: 0 }, 'no import_queue_jobs table → sweep applies to all');

  // learner-facing retry state (import page banner)
  db.importPayment.findMany = async ({ where }: any) => pays.filter((p) => p.status === 'paid' && p.userImportId === null && p.importAttempts > 0 && !p.refundDue).map((p) => ({ id: p.id, importType: 'pdf' }));
  db.importPayment.count = async () => pays.filter((p) => p.refundDue).length;
  const st = await svc.importRetryState('u');
  assert.ok(st.freeRetries.some((r: any) => r.paymentId === 'p4'), 'released payment offered as a free retry');
  assert.equal(st.refundDue, 1);

  console.log('payments-02.test: ok');
})().catch((e) => { console.error(e); process.exit(1); });
