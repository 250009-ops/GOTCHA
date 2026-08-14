import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Keep aligned with Prisma `AppLanguage` / `@gotcha/shared`. */
export const APP_LANGUAGES = ['en', 'ru', 'uz', 'fr', 'es', 'ja', 'de', 'ko', 'pt'] as const;

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(name?: string | null, email?: string) {
  const base = (name || email || 'G').trim();
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

export function formatNumber(n: number) {
  return new Intl.NumberFormat('en-US').format(n);
}

/**
 * Format a monetary value with the appropriate currency symbol/label.
 * @param n The numeric amount
 * @param currency 'USD' | 'UZS' (default: 'UZS' for backward compatibility with import pricing)
 * @param fractionDigits Override decimal places; auto-detected if omitted
 */
export function formatMoney(n: number, currency: 'USD' | 'UZS' = 'UZS', fractionDigits?: number) {
  if (currency === 'USD') {
    const digits = fractionDigits ?? (Number.isInteger(n) ? 0 : 2);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: digits,
      minimumFractionDigits: digits,
    }).format(n);
  }
  // UZS (soʻm) — large whole amounts → no decimals
  const digits =
    fractionDigits ??
    (Math.abs(n) >= 100 || Number.isInteger(n) ? 0 : Math.abs(n) > 0 && Math.abs(n) < 1 ? 4 : 2);
  return (
    new Intl.NumberFormat('uz-UZ', {
      maximumFractionDigits: digits,
      minimumFractionDigits: digits,
    }).format(n) + " soʻm"
  );
}

export function relativeTime(iso: string | Date) {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} mins ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function levelBadgeClass(level?: string | null) {
  const l = (level ?? '').toLowerCase();
  if (l === 'a1') return 'bg-emerald-50 text-emerald-700';
  if (l === 'a2') return 'bg-sky-50 text-sky-700';
  if (l === 'b1') return 'bg-violet-50 text-violet-700';
  if (l === 'b2') return 'bg-fuchsia-50 text-fuchsia-700';
  if (l === 'c1' || l === 'c2') return 'bg-amber-50 text-amber-700';
  return 'bg-slate-100 text-slate-600';
}
