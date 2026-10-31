import { Prisma, PrismaClient } from '@prisma/client';

/**
 * Durable Postgres-backed import queue (table import_queue_jobs, migration 0030_import_queue).
 * - Claim: UPDATE … WHERE id = (SELECT … FOR UPDATE SKIP LOCKED LIMIT 1) — safe with N workers.
 * - Heartbeat: the owning worker bumps heartbeat_at every IMPORT_HEARTBEAT_MS while it runs.
 * - Reaper: a running job whose heartbeat is older than IMPORT_STALE_MS is re-queued (or failed
 *   when out of attempts). Worst-case detection = STALE + REAP interval = 60 s + 30 s ≤ 2 min.
 * - Fencing: complete/fail/heartbeat only succeed while locked_by = this worker, so a job that was
 *   reaped from a frozen worker can't be completed twice.
 */
// PAY2-22: columns are TIMESTAMP(3) (no tz) written as UTC by Prisma, so raw SQL uses (now() AT TIME ZONE 'UTC'): correct for any DB session TimeZone (the throwaway cluster runs Asia/Tashkent).
export const IMPORT_HEARTBEAT_MS = 15_000;
export const IMPORT_STALE_MS = 60_000;
export const IMPORT_REAP_INTERVAL_MS = 30_000;
export const IMPORT_MAX_ATTEMPTS = 3;
/** Hard ceiling per attempt; the worker process exits (PM2 restarts it) if a run overshoots. */
export const IMPORT_JOB_TIMEOUT_MS = 20 * 60_000;

export type ImportJobKind = 'file' | 'url' | 'paste';
export type ImportJobStatus = 'queued' | 'running' | 'done' | 'failed';

export interface ImportQueueRow {
  id: string;
  user_import_id: string;
  kind: ImportJobKind;
  status: ImportJobStatus;
  attempts: number;
  max_attempts: number;
  payload: Prisma.JsonValue;
  last_error: string | null;
}

type Db = Pick<PrismaClient, '$queryRaw' | '$executeRaw'> & {
  importQueueJob: PrismaClient['importQueueJob'];
};

export function backoffMs(attempt: number): number {
  // 1st retry after 10 s, 2nd after 40 s, then 90 s.
  return Math.min(90_000, 10_000 * attempt * attempt);
}

export async function enqueueImportJob(
  db: Pick<PrismaClient, 'importQueueJob'> | Prisma.TransactionClient,
  input: { userImportId: string; kind: ImportJobKind; payload: Prisma.InputJsonValue; maxAttempts?: number },
) {
  return db.importQueueJob.create({
    data: {
      userImportId: input.userImportId,
      kind: input.kind,
      payload: input.payload,
      status: 'queued',
      maxAttempts: input.maxAttempts ?? IMPORT_MAX_ATTEMPTS,
    },
  });
}

export async function claimNextImportJob(db: Db, workerId: string): Promise<ImportQueueRow | null> {
  const rows = await db.$queryRaw<ImportQueueRow[]>`
    UPDATE import_queue_jobs
       SET status = 'running', locked_by = ${workerId}, locked_at = (now() AT TIME ZONE 'UTC'), heartbeat_at = (now() AT TIME ZONE 'UTC'),
           attempts = attempts + 1, updated_at = (now() AT TIME ZONE 'UTC')
     WHERE id = (
       SELECT id FROM import_queue_jobs
        WHERE status = 'queued' AND run_after <= (now() AT TIME ZONE 'UTC')
        ORDER BY run_after, created_at
        FOR UPDATE SKIP LOCKED
        LIMIT 1)
    RETURNING id, user_import_id, kind, status, attempts, max_attempts, payload, last_error`;
  return rows[0] ?? null;
}

/** Returns false when this worker no longer owns the job (it was reaped) — caller must stop. */
export async function heartbeatImportJob(db: Db, jobId: string, workerId: string): Promise<boolean> {
  const n = await db.$executeRaw`
    UPDATE import_queue_jobs SET heartbeat_at = (now() AT TIME ZONE 'UTC'), updated_at = (now() AT TIME ZONE 'UTC')
     WHERE id = ${jobId}::uuid AND status = 'running' AND locked_by = ${workerId}`;
  return n === 1;
}

export async function completeImportJob(db: Db | Prisma.TransactionClient, jobId: string, workerId: string): Promise<boolean> {
  const n = await (db as Db).$executeRaw`
    UPDATE import_queue_jobs
       SET status = 'done', finished_at = (now() AT TIME ZONE 'UTC'), locked_by = NULL, last_error = NULL, updated_at = (now() AT TIME ZONE 'UTC')
     WHERE id = ${jobId}::uuid AND status = 'running' AND locked_by = ${workerId}`;
  return n === 1;
}

/**
 * Records a failed attempt. Re-queues with backoff while attempts remain, otherwise marks failed.
 * `final` is true only for the single caller that moved the job to failed (exactly-once finalize).
 */
export async function failImportJobAttempt(
  db: Db,
  jobId: string,
  workerId: string,
  error: string,
  opts: { retryable: boolean },
): Promise<{ owned: boolean; final: boolean }> {
  const rows = await db.$queryRaw<{ status: string; attempts: number }[]>`
    UPDATE import_queue_jobs
       SET status = CASE WHEN ${opts.retryable}::boolean AND attempts < max_attempts THEN 'queued' ELSE 'failed' END,
           run_after = (now() AT TIME ZONE 'UTC') + make_interval(secs => LEAST(90, 10 * attempts * attempts)),
           finished_at = CASE WHEN ${opts.retryable}::boolean AND attempts < max_attempts THEN NULL ELSE (now() AT TIME ZONE 'UTC') END,
           locked_by = NULL, last_error = ${error.slice(0, 2000)}, updated_at = (now() AT TIME ZONE 'UTC')
     WHERE id = ${jobId}::uuid AND status = 'running' AND locked_by = ${workerId}
    RETURNING status, attempts`;
  if (!rows[0]) return { owned: false, final: false };
  return { owned: true, final: rows[0].status === 'failed' };
}

/**
 * Re-queues (or fails) running jobs whose heartbeat stopped — e.g. the worker crashed, was
 * redeployed, or the box rebooted. Returns the user_import ids that just became final failures.
 */
export async function reapStaleImportJobs(
  db: Db,
  staleMs = IMPORT_STALE_MS,
): Promise<{ requeued: string[]; failed: { jobId: string; userImportId: string }[] }> {
  const rows = await db.$queryRaw<{ id: string; user_import_id: string; status: string }[]>`
    UPDATE import_queue_jobs
       SET status = CASE WHEN attempts < max_attempts THEN 'queued' ELSE 'failed' END,
           finished_at = CASE WHEN attempts < max_attempts THEN NULL ELSE (now() AT TIME ZONE 'UTC') END,
           run_after = (now() AT TIME ZONE 'UTC'), locked_by = NULL,
           last_error = ${`Worker stopped responding (no heartbeat for ${Math.round(staleMs / 1000)}s)`},
           updated_at = (now() AT TIME ZONE 'UTC')
     WHERE status = 'running'
       AND (heartbeat_at IS NULL OR heartbeat_at < (now() AT TIME ZONE 'UTC') - make_interval(secs => ${staleMs / 1000}::float8))
    RETURNING id, user_import_id, status`;
  return {
    requeued: rows.filter((r) => r.status === 'queued').map((r) => r.id),
    failed: rows.filter((r) => r.status === 'failed').map((r) => ({ jobId: r.id, userImportId: r.user_import_id })),
  };
}

/** User retry: fresh attempts, immediate run. Only from a terminal failed state. */
export async function requeueFailedImportJob(db: Db | Prisma.TransactionClient, userImportId: string): Promise<boolean> {
  const n = await (db as Db).$executeRaw`
    UPDATE import_queue_jobs
       SET status = 'queued', attempts = 0, run_after = (now() AT TIME ZONE 'UTC'), locked_by = NULL, finished_at = NULL,
           last_error = NULL, updated_at = (now() AT TIME ZONE 'UTC')
     WHERE user_import_id = ${userImportId}::uuid AND status = 'failed'`;
  return n === 1;
}
