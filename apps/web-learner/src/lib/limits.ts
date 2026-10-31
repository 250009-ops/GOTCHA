import { limitNoticeFromError, type LimitNotice } from '@gotcha/shared';

/** final-5 B4: payments flag, default OFF. Only the literal 'true' turns paid upsells on. */
export function paymentsEnabled(): boolean {
  return import.meta.env.VITE_PAYMENTS_ENABLED === 'true';
}

export const LIMIT_EVENT = 'gotcha:limit-notice';

export function showLimitNotice(notice: LimitNotice): void {
  window.dispatchEvent(new CustomEvent<LimitNotice>(LIMIT_EVENT, { detail: notice }));
}

/** Shows the limit screen when `err` is a limit/payments-off 403. Returns true if handled. */
export function handleLimitError(err: unknown, lang: string = typeof document !== 'undefined' ? document.documentElement.lang : 'en'): boolean {
  const e = err as { code?: string; body?: Record<string, unknown> } | null;
  const notice = limitNoticeFromError(e, lang === 'ru' || lang === 'uz' ? lang : 'en');
  if (!notice) return false;
  showLimitNotice(notice);
  return true;
}
