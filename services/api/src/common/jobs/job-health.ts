import { Logger } from '@nestjs/common';
import { reportRecipients } from '../safety/report-notify';

/**
 * LG4-09: retention/deletion jobs (account purge, TTS cleanup, pass expiry …) must never fail silently.
 * Every run is recorded here; a failure is logged at ERROR, flips the admin health flag
 * (GET /admin/health/jobs) and emails support@gotchaa.uz (+ REPORTS_ADMIN_EMAIL).
 * STUB: when SMTP is not configured the email is only a "[STUB]" error log — the admin flag still flips.
 */
type Mailer = { isConfigured(): boolean; send(o: { to: string; subject: string; text: string; html: string }): Promise<boolean> };
export type JobStatus = { job: string; ok: boolean; lastRunAt: string; lastOkAt: string | null; lastError: string | null; failures: number; detail?: string };

const log = new Logger('JobHealth');
const state = new Map<string, JobStatus>();
let mailer: Mailer | undefined;

export function setJobAlertMailer(m: Mailer | undefined) { mailer = m; }
export function jobHealth(): { ok: boolean; jobs: JobStatus[] } {
  const jobs = [...state.values()];
  return { ok: jobs.every((j) => j.ok), jobs };
}
export function resetJobHealth() { state.clear(); }

export function recordJobSuccess(job: string, detail?: string, now = new Date()) {
  const prev = state.get(job);
  state.set(job, { job, ok: true, lastRunAt: now.toISOString(), lastOkAt: now.toISOString(), lastError: null, failures: 0, detail });
  if (prev && !prev.ok) log.log(`job ${job} recovered`);
}

/** Returns true when an alert email was handed to SMTP, false when stubbed. Never throws. */
export async function recordJobFailure(job: string, err: unknown, now = new Date()): Promise<boolean> {
  const msg = err instanceof Error ? err.message : String(err);
  const prev = state.get(job);
  state.set(job, { job, ok: false, lastRunAt: now.toISOString(), lastOkAt: prev?.lastOkAt ?? null, lastError: msg.slice(0, 500), failures: (prev?.failures ?? 0) + 1 });
  log.error(`job ${job} FAILED: ${msg}`);
  const subject = `[Gotcha] Job failed: ${job}`;
  const text = `The scheduled job "${job}" failed at ${now.toISOString()}.\nError: ${msg.slice(0, 500)}\nCheck GET /admin/health/jobs and the API logs.\n`;
  if (!mailer || !mailer.isConfigured()) {
    log.error(`[STUB] SMTP not configured — job failure alert for ${job} not emailed to ${reportRecipients().join(', ')}`);
    return false;
  }
  for (const to of reportRecipients()) {
    try { await mailer.send({ to, subject, text, html: `<pre>${text.replace(/[<&]/g, (c) => (c === '<' ? '&lt;' : '&amp;'))}</pre>` }); }
    catch (e) { log.error(`job alert to ${to} failed: ${e instanceof Error ? e.message : e}`); }
  }
  return true;
}

/** Runs fn, records the outcome. Rethrows nothing; returns the result or undefined on failure. */
export async function runTrackedJob<T>(job: string, fn: () => Promise<T>, describe?: (r: T) => string): Promise<T | undefined> {
  try {
    const r = await fn();
    recordJobSuccess(job, describe?.(r));
    return r;
  } catch (e) {
    await recordJobFailure(job, e);
    return undefined;
  }
}
