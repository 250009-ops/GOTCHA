// Learner payment history client + pure view helpers (no React, unit-tested in payments.test.ts).
import { api } from './api';

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'expired' | 'refunded';

export type PaymentSummary = {
  id: string;
  kind: 'import' | 'catalog' | 'play' | 'plus' | 'admin_grant';
  source?: 'atmos' | 'google_play' | 'admin';
  plusDays?: number | null;
  endsAt?: string | null;
  ownReceiptPath?: string | null;
  needsAttention?: boolean;
  contentId?: string | null;
  status: PaymentStatus | string;
  amountUzs: number;
  currency: string;
  estimatedPages: number;
  contentFormat: string;
  createdAt: string;
  paidAt: string | null;
  receiptUrl: string | null;
};

export type PaymentsPage = { items: PaymentSummary[]; nextCursor: string | null };

export function listPayments(cursor?: string | null, limit = 20) {
  const q = new URLSearchParams({ limit: String(limit) });
  if (cursor) q.set('cursor', cursor);
  return api<PaymentsPage>(`/billing/payments?${q.toString()}`);
}

export function formatSom(amount: number) {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(amount)) + ' soʻm';
}

/** A price ≤ 0 is "not priced", never "0 soʻm" (live 901–1500 bug). */
export function priceOrNull(amount: number | null | undefined): string | null {
  const n = Number(amount);
  return Number.isFinite(n) && n > 0 ? formatSom(n) : null;
}

export const STATUS_TONE: Record<string, 'ok' | 'wait' | 'bad' | 'muted'> = {
  paid: 'ok',
  pending: 'wait',
  failed: 'bad',
  expired: 'muted',
  refunded: 'muted',
};

/** PAY1-09: localized label key for payment AND pass statuses (never show raw 'active'). */
export function paymentStatusKey(status: string): `status.${string}` | null {
  return ['paid', 'pending', 'failed', 'expired', 'refunded', 'active', 'revoked', 'canceled'].includes(status) ? `status.${status}` : null;
}

/** PAY1-12: source label key; Play-sourced rows/receipts say Google Play (Plus checkout itself is web-only). */
export function paymentSourceKey(source: string | null | undefined): 'history.src.play' | 'history.src.admin' | 'history.src.atmos' {
  return source === 'google_play' ? 'history.src.play' : source === 'admin' ? 'history.src.admin' : 'history.src.atmos';
}

export function statusTone(status: string) {
  return STATUS_TONE[status] ?? 'muted';
}

export type TitleCopy = { book: string; import: string; plus: string; grant: string; days: (n: number) => string; pages: (n: number) => string };
const EN_TITLES: TitleCopy = { book: 'Book purchase', import: 'Import', plus: 'Plus pass', grant: 'Gift from Gotcha', days: (n) => `${n} days`, pages: (n) => `~${n} pages` };

export function paymentTitle(p: Pick<PaymentSummary, 'kind' | 'estimatedPages'> & { plusDays?: number | null }, c: TitleCopy = EN_TITLES) {
  if (p.kind === 'catalog') return c.book;
  if (p.kind === 'plus' || p.kind === 'play') return p.plusDays ? `${c.plus} · ${c.days(p.plusDays)}` : c.plus;
  if (p.kind === 'admin_grant') return c.grant;
  return `${c.import} · ${c.pages(p.estimatedPages)}`;
}

/** Our receipt is an API path (same origin); only relative /billing paths are allowed. */
export function safeOwnReceipt(path: string | null | undefined) {
  return path && /^\/billing\/payments\/[\w-]+\/receipt$/.test(path) ? path : null;
}

/** Kind of a single payment row from its contentFormat (plus_pass:N) / contentId. */
export function paymentKindOf(p: { contentFormat?: string | null; contentId?: string | null }): 'plus' | 'catalog' | 'import' {
  if (p.contentFormat && p.contentFormat.startsWith('plus_pass:')) return 'plus';
  if (p.contentId) return 'catalog';
  return 'import';
}

/** Dates in Asia/Tashkent so learners see local time regardless of device zone. */
const UZ_MONTHS = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'];

/** PAY1-10: uz → "30-okt 2026, 13:21" (Tashkent time via Intl parts, month names manual: ICU uz data varies by browser). */
export function formatPaymentDate(iso: string, locale = 'en-GB') {
  if (/^uz/i.test(locale)) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Tashkent', day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
    return `${Number(parts.day)}-${UZ_MONTHS[Number(parts.month) - 1]} ${parts.year}, ${parts.hour}:${parts.minute}`;
  }
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'Asia/Tashkent', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

/** Only https receipts (Atmos OFD) are linkable. */
export function safeReceiptUrl(url: string | null | undefined) {
  return url && /^https:\/\//i.test(url) ? url : null;
}

export function mergePages(prev: PaymentSummary[], next: PaymentSummary[]) {
  const seen = new Set(prev.map((p) => p.id));
  return [...prev, ...next.filter((p) => !seen.has(p.id))];
}

/** 11d success line: fills {date} (DD.MM.YYYY, Asia/Tashkent) into pay-copy.json plus.successSub. */
export function plusSuccessLine(template: string, endsAt: string | Date): string {
  const d = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(endsAt)).replace(/\//g, '.');
  return template.replace('{date}', d);
}
