import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { readdir, stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';

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
export async function purgeOldTts(dir: string, days: number, now = Date.now()): Promise<{ scanned: number; deleted: number }> {
  if (days <= 0) return { scanned: 0, deleted: 0 };
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return { scanned: 0, deleted: 0 };
  }
  const cutoff = now - days * DAY_MS;
  let deleted = 0;
  let scanned = 0;
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
    } catch {
      // raced with another delete/write — skip
    }
  }
  return { scanned, deleted };
}

@Injectable()
export class TtsRetentionJob implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('TtsRetention');
  private timer: ReturnType<typeof setInterval> | undefined;
  private first: ReturnType<typeof setTimeout> | undefined;

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
    const r = await purgeOldTts(ttsDir(), days);
    this.logger.log(`TTS cleanup: deleted ${r.deleted}/${r.scanned} mp3 older than ${days} d`);
    return r;
  }
}
