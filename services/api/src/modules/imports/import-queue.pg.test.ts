/**
 * Integration test for the Postgres import queue. Needs a disposable DB:
 *   DATABASE_URL=postgresql://gotcha@localhost:55499/gotcha_p0 npm run test:import-queue
 */
import * as assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import {
  claimNextImportJob,
  completeImportJob,
  enqueueImportJob,
  failImportJobAttempt,
  heartbeatImportJob,
  reapStaleImportJobs,
  requeueFailedImportJob,
} from './import-queue';

const prisma = new PrismaClient();

async function mkImport(userId: string) {
  const ui = await prisma.userImport.create({ data: { userId, title: 't', importType: 'pdf', ingestionStatus: 'queued' } });
  await enqueueImportJob(prisma, { userImportId: ui.id, kind: 'file', payload: { x: 1 } });
  return ui.id;
}
const jobOf = (userImportId: string) => prisma.importQueueJob.findUniqueOrThrow({ where: { userImportId } });
async function age(userImportId: string, secs: number) {
  await prisma.$executeRaw`UPDATE import_queue_jobs SET heartbeat_at = now() - make_interval(secs => ${secs}::float8) WHERE user_import_id = ${userImportId}::uuid`;
}
async function drain() {
  // isolate: hide everything not created by this test run
  await prisma.$executeRaw`UPDATE import_queue_jobs SET status='done' WHERE status IN ('queued','running')`;
}

async function main() {
  if (!/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? '')) throw new Error('Refusing to run against a non-local DATABASE_URL');
  await drain();
  const user = await prisma.user.create({ data: { email: `q-${Date.now()}@test.local`, nativeLanguage: 'en' } });
  try {
    // 1. SKIP LOCKED: 10 jobs, 8 concurrent claimers → every job claimed exactly once
    const ids = await Promise.all(Array.from({ length: 10 }, () => mkImport(user.id)));
    const claimed: string[] = [];
    await Promise.all(
      Array.from({ length: 8 }, async (_, w) => {
        for (;;) {
          const j = await claimNextImportJob(prisma, `w${w}`);
          if (!j) return;
          claimed.push(j.user_import_id);
        }
      }),
    );
    assert.equal(claimed.length, 10);
    assert.equal(new Set(claimed).size, 10);
    assert.deepEqual([...claimed].sort(), [...ids].sort());
    for (const id of ids) {
      const j = await jobOf(id);
      assert.equal(j.status, 'running');
      assert.equal(j.attempts, 1);
      assert.ok(await completeImportJob(prisma, j.id, j.lockedBy!));
    }

    // 2. Heartbeat + fencing
    const a = await mkImport(user.id);
    const ja = (await claimNextImportJob(prisma, 'A'))!;
    assert.equal(ja.user_import_id, a);
    assert.equal(await heartbeatImportJob(prisma, ja.id, 'A'), true);
    assert.equal(await heartbeatImportJob(prisma, ja.id, 'B'), false);
    assert.equal(await completeImportJob(prisma, ja.id, 'B'), false, 'non-owner cannot complete');

    // 3. Stuck detection: heartbeat 61s old → reaped & re-queued; dead worker's result is fenced off
    await age(a, 61);
    const r1 = await reapStaleImportJobs(prisma);
    assert.deepEqual(r1.requeued, [ja.id]);
    assert.equal(await completeImportJob(prisma, ja.id, 'A'), false, 'reaped worker cannot complete');
    assert.equal(await heartbeatImportJob(prisma, ja.id, 'A'), false);
    // fresh heartbeat is not reaped
    const jb = (await claimNextImportJob(prisma, 'B'))!;
    assert.equal(jb.id, ja.id);
    assert.equal(jb.attempts, 2);
    await age(a, 30);
    assert.deepEqual((await reapStaleImportJobs(prisma)).requeued, []);

    // 4. Final failure reported exactly once after max attempts (crash x3)
    await age(a, 61);
    await reapStaleImportJobs(prisma);
    const jc = (await claimNextImportJob(prisma, 'C'))!;
    assert.equal(jc.attempts, 3);
    await age(a, 61);
    const r2 = await reapStaleImportJobs(prisma);
    assert.deepEqual(r2.failed, [{ jobId: ja.id, userImportId: a }]);
    assert.deepEqual(await reapStaleImportJobs(prisma), { requeued: [], failed: [] });
    assert.equal(await claimNextImportJob(prisma, 'D'), null);

    // 5. Retryable error → backoff requeue; non-retryable → final once
    const b = await mkImport(user.id);
    const j1 = (await claimNextImportJob(prisma, 'E'))!;
    assert.deepEqual(await failImportJobAttempt(prisma, j1.id, 'E', 'ECONNRESET', { retryable: true }), { owned: true, final: false });
    assert.equal(await claimNextImportJob(prisma, 'E'), null, 'backoff: not runnable yet');
    await prisma.$executeRaw`UPDATE import_queue_jobs SET run_after = now() WHERE id = ${j1.id}::uuid`;
    const j2 = (await claimNextImportJob(prisma, 'E'))!;
    assert.equal(j2.id, j1.id);
    assert.deepEqual(await failImportJobAttempt(prisma, j2.id, 'E', 'password-protected', { retryable: false }), { owned: true, final: true });
    assert.deepEqual(await failImportJobAttempt(prisma, j2.id, 'E', 'again', { retryable: false }), { owned: false, final: false });

    // 6. Manual retry only from failed; resets attempts
    assert.equal(await requeueFailedImportJob(prisma, b), true);
    assert.equal(await requeueFailedImportJob(prisma, b), false);
    const j3 = (await claimNextImportJob(prisma, 'F'))!;
    assert.equal(j3.attempts, 1);
    assert.ok(await completeImportJob(prisma, j3.id, 'F'));
    assert.equal(await requeueFailedImportJob(prisma, b), false, 'done job is not retryable');

    // 7. Worst-case stuck detection bound
    const { IMPORT_STALE_MS, IMPORT_REAP_INTERVAL_MS } = await import('./import-queue');
    assert.ok(IMPORT_STALE_MS + IMPORT_REAP_INTERVAL_MS <= 120_000);

    console.log('import-queue pg tests: OK');
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.$disconnect();
  }
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
