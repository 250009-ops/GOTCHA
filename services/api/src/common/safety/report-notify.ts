import { Logger } from '@nestjs/common';

/**
 * New-report notification (P3c, 24 h SLA). Sends via the existing SMTP MailService when SMTP_HOST is set.
 * Recipients: support@gotchaa.uz + REPORTS_ADMIN_EMAIL (comma-separated; unset → support only).
 * Body carries no reported text / personal data — only id, kind, reason and the admin link.
 *
 * STUB NOTICE: if SMTP is not configured (or support@ can't receive yet — DevOps/owner, plan P0-8),
 * this only logs a warning. Nothing else (no in-app/Telegram) is wired.
 */
export const REPORTS_SUPPORT_EMAIL = 'support@gotchaa.uz';
type Mailer = { isConfigured(): boolean; send(o: { to: string; subject: string; text: string; html: string }): Promise<boolean> };
const log = new Logger('ReportNotify');

export function reportRecipients(env: Record<string, string | undefined> = process.env): string[] {
  const extra = (env.REPORTS_ADMIN_EMAIL ?? '').split(',').map((s) => s.trim()).filter((s) => /.+@.+/.test(s));
  return [...new Set([REPORTS_SUPPORT_EMAIL, ...extra])];
}

export function reportEmail(r: { id: string; kind: 'user' | 'content'; reason: string }, adminBase?: string) {
  const link = `${(adminBase || process.env.ADMIN_APP_URL || 'https://gotchaa.uz/admin').replace(/\/$/, '')}/reports?kind=${r.kind}&id=${r.id}`;
  const subject = `[Gotcha] New ${r.kind} report (${r.reason}) — review within 24 h`;
  const text = `A new ${r.kind} report was filed.\nReason: ${r.reason}\nReport id: ${r.id}\nReview it in the admin queue: ${link}\n`;
  const html = `<p>A new ${r.kind} report was filed.</p><p>Reason: <b>${r.reason}</b><br>Report id: ${r.id}</p><p><a href="${link}">Open the admin Reports queue</a></p>`;
  return { subject, text, html };
}

/** Fire-and-forget; never fails the report request. */
export function notifyNewReport(mail: Mailer | undefined, r: { id: string; kind: 'user' | 'content'; reason: string }): void {
  const to = reportRecipients();
  if (!mail || !mail.isConfigured()) {
    log.warn(`[STUB] SMTP not configured — new ${r.kind} report ${r.id} (${r.reason}) not emailed to ${to.join(', ')}`);
    return;
  }
  const msg = reportEmail(r);
  for (const addr of to) {
    void mail.send({ to: addr, ...msg }).catch((e) => log.warn(`report email to ${addr} failed: ${e instanceof Error ? e.message : e}`));
  }
}
