import { Injectable, Logger, OnApplicationShutdown, Optional } from '@nestjs/common';
import { hostname } from 'os';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { recordJobFailure, recordJobSuccess } from '../../common/jobs/job-health';
import { MashqBatchRunner } from '../practice/mashq-batch';
import { ImportsService, isRetryableImportError } from './imports.service';
import {
  claimNextImportJob,
  failImportJobAttempt,
  heartbeatImportJob,
  IMPORT_HEARTBEAT_MS,
  IMPORT_JOB_TIMEOUT_MS,
  IMPORT_REAP_INTERVAL_MS,
  IMPORT_STALE_MS,
  ImportQueueRow,
  importQueueCounts,
  reapStaleImportJobs,
  releaseImportJob,
} from './import-queue';

/** How long SIGTERM waits for running jobs before releasing them (keep below PM2 --kill-timeout). */
export function importWorkerDrainMs(env = process.env): number {
  const n = Number(env.IMPORT_WORKER_DRAIN_MS);
  return Number.isFinite(n) && n >= 0 ? Math.min(120_000, Math.floor(n)) : 20_000;
}

export function importWorkerConcurrency(env = process.env): number {
  const n = Number(env.IMPORT_WORKER_CONCURRENCY);
  return Number.isFinite(n) && n >= 1 ? Math.min(8, Math.floor(n)) : 2;
}

/**
 * Import queue consumer. Runs in its own process (dist/worker.js, PM2 app "gotcha-import-worker")
 * so OCR / tokenizing never block the API event loop and a deploy of the API doesn't kill jobs.
 */
@Injectable()
export class ImportWorker implements OnApplicationShutdown {
  private readonly logger = new Logger('ImportWorker');
  readonly workerId = `${hostname()}:${process.pid}:${randomUUID().slice(0, 8)}`;
  private running = 0;
  /** Job ids this process currently owns (released back to the queue on shutdown). */
  private readonly inFlight = new Set<string>();
  private stopping = false;
  private pollTimer?: ReturnType<typeof setTimeout>;
  private reapTimer?: ReturnType<typeof setInterval>;
  private mashqTimer?: ReturnType<typeof setInterval>;
  private idle: Array<() => void> = [];
  readonly concurrency = importWorkerConcurrency();
  /** Optional hook for tests/benchmarks. */
  onJobDone?: (r: { job: ImportQueueRow; ok: boolean; ms: number; timings?: Record<string, number>; error?: string }) => void;

  constructor(
    private prisma: PrismaService,
    private imports: ImportsService,
    @Optional() private mashq?: MashqBatchRunner,
  ) {}

  start(pollMs = 1000) {
    this.logger.log(`Import worker ${this.workerId} started (concurrency=${this.concurrency}, heartbeat=${IMPORT_HEARTBEAT_MS}ms, stale=${IMPORT_STALE_MS}ms)`);
    // Rows left queued while no worker ran (e.g. the 2 prod rows) are claimed by the normal loop below.
    void importQueueCounts(this.prisma)
      .then((c) => this.logger.log(`Queue on start: ${JSON.stringify(c)}`))
      .catch(() => undefined);
    void this.housekeeping();
    if (this.mashq) {
      void this.mashq.tick();
      this.mashqTimer = setInterval(() => void this.mashq?.tick(), 60_000);
    }
    this.reapTimer = setInterval(() => void this.housekeeping(), IMPORT_REAP_INTERVAL_MS);
    const loop = async () => {
      if (this.stopping) return;
      try {
        while (!this.stopping && this.running < this.concurrency) {
          const job = await claimNextImportJob(this.prisma, this.workerId);
          if (!job) break;
          this.running++;
          this.inFlight.add(job.id);
          void this.runJob(job).finally(() => {
            this.inFlight.delete(job.id);
            this.running--;
            if (this.running === 0) this.idle.splice(0).forEach((f) => f());
            if (!this.stopping) setImmediate(() => void loop());
          });
        }
      } catch (err) {
        this.logger.error(`claim failed: ${err instanceof Error ? err.message : err}`);
      }
      if (!this.stopping) this.pollTimer = setTimeout(() => void loop(), pollMs);
    };
    void loop();
  }

  async housekeeping() {
    try {
      const reaped = await reapStaleImportJobs(this.prisma);
      if (reaped.requeued.length) this.logger.warn(`Re-queued ${reaped.requeued.length} stalled import job(s)`);
      for (const f of reaped.failed) {
        await this.imports.finalizeFailure(f.userImportId, new Error('Import stopped responding and ran out of attempts.'));
      }
      await this.imports.failStaleLegacyImports();
      await this.imports.sweepExpiredUploads();
      recordJobSuccess('import-queue-reaper', `requeued=${reaped.requeued.length} failed=${reaped.failed.length}`);
    } catch (err) {
      await recordJobFailure('import-queue-reaper', err);
    }
  }

  private async runJob(job: ImportQueueRow) {
    const started = Date.now();
    let lost = false;
    const hb = setInterval(() => {
      void heartbeatImportJob(this.prisma, job.id, this.workerId)
        .then((owned) => {
          if (!owned && !lost) {
            lost = true;
            this.logger.warn(`Job ${job.id} lost ownership (reaped); result will be discarded`);
          }
        })
        .catch(() => undefined);
    }, IMPORT_HEARTBEAT_MS);
    // A run that overshoots the hard ceiling can't be cancelled cooperatively (pdfjs/OCR):
    // record the failed attempt and exit — PM2 restarts the worker with a clean heap.
    const guard = setTimeout(() => {
      void failImportJobAttempt(this.prisma, job.id, this.workerId, `Import exceeded ${Math.round(IMPORT_JOB_TIMEOUT_MS / 60000)} min`, { retryable: true })
        .then(async (r) => {
          if (r.final) await this.imports.finalizeFailure(job.user_import_id, new Error('Import took too long.'));
        })
        .finally(() => {
          this.logger.error(`Job ${job.id} exceeded hard timeout — exiting worker for a clean restart`);
          process.exit(70);
        });
    }, IMPORT_JOB_TIMEOUT_MS);
    try {
      const r = await this.imports.processJob(job, this.workerId);
      this.logger.log(`Import ${job.user_import_id} ready in ${Date.now() - started} ms ${JSON.stringify(r.timings)}`);
      this.onJobDone?.({ job, ok: true, ms: Date.now() - started, timings: r.timings });
    } catch (err) {
      const retryable = isRetryableImportError(err);
      const msg = err instanceof Error ? err.message : String(err);
      const r = await failImportJobAttempt(this.prisma, job.id, this.workerId, msg, { retryable }).catch(() => ({ owned: false, final: false }));
      if (r.owned) {
        if (r.final) await this.imports.finalizeFailure(job.user_import_id, err);
        else await this.imports.noteAttemptFailed(job.user_import_id, err, true, job.attempts, job.max_attempts);
      }
      this.onJobDone?.({ job, ok: false, ms: Date.now() - started, error: msg });
    } finally {
      clearInterval(hb);
      clearTimeout(guard);
    }
  }

  /**
   * Graceful stop (SIGTERM): stop claiming, wait (bounded) for running jobs, then hand any job still
   * running back to the queue without burning an attempt. A released job's late result is fenced off
   * (completeImportJob needs locked_by = us), so another worker re-runs it exactly once; no charge path
   * runs because only the owner that moves a job to "failed" calls finalizeFailure.
   * Must run BEFORE Prisma disconnects — dist/worker.js calls it from its own signal handler.
   */
  async stop(waitMs = importWorkerDrainMs()): Promise<{ released: string[] }> {
    this.stopping = true;
    if (this.pollTimer) clearTimeout(this.pollTimer);
    if (this.reapTimer) clearInterval(this.reapTimer);
    if (this.mashqTimer) clearInterval(this.mashqTimer);
    if (this.running > 0) {
      await Promise.race([new Promise<void>((r) => this.idle.push(r)), new Promise((r) => setTimeout(r, waitMs))]);
    }
    const released: string[] = [];
    for (const id of [...this.inFlight]) {
      if (await releaseImportJob(this.prisma, id, this.workerId).catch(() => false)) released.push(id);
    }
    if (released.length) this.logger.warn(`Released ${released.length} in-flight job(s) back to the queue: ${released.join(', ')}`);
    return { released };
  }

  async onApplicationShutdown() {
    if (!this.stopping) await this.stop().catch(() => undefined);
  }
}
