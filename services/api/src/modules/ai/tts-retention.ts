import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { readdir, stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { MailService } from '../../common/mail/mail.service';
import { runTrackedJob, setJobAlertMailer } from '../../common/jobs/job-health';

/** TTS mp3 cache retention (privacy/terms: 30 days). TTS_RETENTION_DAYS overrides; 0 disables the job. */
export const DEFAULT_TTS_RETENTION_DAYS = 30;
const DAY_MS = 86_400_000;

export function ttsRetentionDays(env: Record<string, string | undefined> = process.env): number {
  const raw = env.TTS_RETENTION_DAYS?.trim();
  if (!raw) return DEFAULT_TTS_RETENTION_DAYS;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : DEFAULT_TTS_RETENTION_DAYS;
}

export const ttsDir = (env: Record<string, string | undefined> = process.env) =>
  join(env.UPLOADS_DIR ?? join(process.cwd(), 'uploads'), 'tts');

/** Deletes *.mp3 in `dir` whose mtime is older than `days`. Returns counts; never throws on a missing dir. */
export async function purgeOldTts(dir: string, days: number, now = Date.now()): Promise<{ scanned: number; deleted: number; failed: number }> {
  if (days <= 0) return { scanned: 0, deleted: 0, failed: 0 };
  let names: string[];
  try {
    names = await readdir(dir);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return { scanned: 0, deleted: 0, failed: 0 };
    throw e; // LG4-09: permission/IO errors must surface
  }
  const cutoff = now - days * DAY_MS;
  let deleted = 0;
  let scanned = 0;
  let failed = 0;
  for (const name of names) {
    if (!name.endsWith('.mp3')) continue;
    scanned++;
    const file = join(dir, name);
    try {
      const st = await stat(file);
      if (st.isFile() && st.mtimeMs < cutoff) {
        await unlink(file);
        deleted++;
      }
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') failed++; // ENOENT = raced with another delete
    }
  }
  if (failed > 0) throw new Error(`TTS cleanup: ${failed} file(s) could not be deleted (deleted ${deleted}/${scanned})`);
  return { scanned, deleted, failed };
}

@Injectable()
export class TtsRetentionJob implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('TtsRetention');
  private timer: ReturnType<typeof setInterval> | undefined;
  private first: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly mail: MailService) {
    setJobAlertMailer(mail);
  }

  onModuleInit() {
    if (ttsRetentionDays() === 0) {
      this.logger.warn('TTS_RETENTION_DAYS=0 — TTS cleanup disabled');
      return;
    }
    this.first = setTimeout(() => void this.run(), 60_000);
    this.timer = setInterval(() => void this.run(), DAY_MS);
    this.first.unref?.();
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    if (this.first) clearTimeout(this.first);
  }

  async run() {
    const days = ttsRetentionDays();
    const r = await runTrackedJob('tts-cleanup', () => purgeOldTts(ttsDir(), days), (x) => `deleted ${x.deleted}/${x.scanned}`);
    if (r) this.logger.log(`TTS cleanup: deleted ${r.deleted}/${r.scanned} mp3 older than ${days} d`);
    return r;
  }
}
