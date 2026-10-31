import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { runTrackedJob } from '../../common/jobs/job-health';

/**
 * Privacy §8: safety reports (user + content) are deleted about 1 year after the report is closed.
 * "Closed" = status reviewed / actioned / dismissed; the close time is reviewedAt (set by SafetyService.resolve).
 * REPORT_RETENTION_DAYS overrides (default 365); 0 disables the job. Idempotent: re-running deletes nothing new.
 */
export const DEFAULT_REPORT_RETENTION_DAYS = 365;
const DAY_MS = 86_400_000;
const CLOSED = ['reviewed', 'actioned', 'dismissed'] as const;

export function reportRetentionDays(env: Record<string, string | undefined> = process.env): number {
  const raw = env.REPORT_RETENTION_DAYS?.trim();
  if (!raw) return DEFAULT_REPORT_RETENTION_DAYS;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : DEFAULT_REPORT_RETENTION_DAYS;
}

type DeleteMany = { deleteMany(args: unknown): Promise<{ count: number }> };
export type ReportRetentionPrisma = { userReport: DeleteMany; contentReport: DeleteMany };

export function closedBefore(cutoff: Date) {
  return { status: { in: [...CLOSED] }, reviewedAt: { not: null, lt: cutoff } };
}

export async function purgeClosedReports(p: ReportRetentionPrisma, days: number, now = Date.now()) {
  if (days <= 0) return { userReports: 0, contentReports: 0, cutoff: null as string | null };
  const cutoff = new Date(now - days * DAY_MS);
  const where = closedBefore(cutoff);
  const u = await p.userReport.deleteMany({ where });
  const c = await p.contentReport.deleteMany({ where });
  return { userReports: u.count, contentReports: c.count, cutoff: cutoff.toISOString() };
}

@Injectable()
export class ReportRetentionJob implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('ReportRetention');
  private timer: ReturnType<typeof setInterval> | undefined;
  private first: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    if (reportRetentionDays() === 0) {
      this.logger.warn('REPORT_RETENTION_DAYS=0 — report retention disabled');
      return;
    }
    this.first = setTimeout(() => void this.run(), 90_000);
    this.timer = setInterval(() => void this.run(), DAY_MS);
    this.first.unref?.();
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    if (this.first) clearTimeout(this.first);
  }

  async run() {
    const days = reportRetentionDays();
    const r = await runTrackedJob(
      'report-retention',
      () => purgeClosedReports(this.prisma as unknown as ReportRetentionPrisma, days),
      (x) => `deleted ${x.userReports} user + ${x.contentReports} content reports`,
    );
    if (r) this.logger.log(`Report retention: deleted ${r.userReports} user reports, ${r.contentReports} content reports closed before ${r.cutoff} (${days} d)`);
    return r;
  }
}
