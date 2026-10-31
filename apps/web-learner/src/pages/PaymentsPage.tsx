// Payment history (PAYMENTS.md §11.4): Atmos, Google Play and admin grants; our receipt + fiscal chek. Reads GET /billing/payments.
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { usePay, PayTrust } from '../components/payments';
import { PAY_SELLER } from '@gotcha/shared';
import {
  formatPaymentDate, paymentSourceKey, paymentStatusKey, listPayments, mergePages, paymentTitle, safeOwnReceipt, safeReceiptUrl, statusTone,
  type PaymentSummary,
} from '../lib/payments';

const TONE = {
  ok: { background: 'var(--g-ok-bg)', color: 'var(--g-ok)' },
  wait: { background: 'var(--g-warn-bg)', color: 'var(--g-warn)' },
  bad: { background: 'var(--g-bad-bg)', color: 'var(--g-bad)' },
  muted: { background: 'var(--g-track)', color: 'var(--g-text-2)' },
} as const;

const LOCALE_TAG: Record<string, string> = { uz: 'uz-UZ', ru: 'ru-RU', en: 'en-GB' };

type Receipt = { receiptNo: string; seller: string; amountUzs: number; paidAt: string | null; status: string; paymentMethod: string; fiscalReceiptUrl: string | null; source?: string | null };

export default function PaymentsPage() {
  const { t, som, locale, errOr } = usePay();
  const [items, setItems] = useState<PaymentSummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<(Receipt & { title: string }) | null>(null);
  const titles = {
    book: t('history.book'), import: t('history.import'), plus: t('history.plus'), grant: t('history.grant'),
    days: (n: number) => (n === 365 ? t('plus.o365') : n === 30 ? t('plus.o30') : `${n}`), pages: (n: number) => `~${n}`,
  };
  const srcLabel = (p: { source?: string | null }) => t(paymentSourceKey(p.source));

  const load = useCallback(async (from: string | null) => {
    setLoading(true); setError(null);
    try {
      const page = await listPayments(from);
      setItems((prev) => (from ? mergePages(prev, page.items) : page.items));
      setCursor(page.nextCursor);
    } catch (e) {
      setError(errOr(e, t('err.generic')));
    } finally { setLoading(false); }
  }, [errOr, t]);

  useEffect(() => { void load(null); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const statusText = (s: string) => { const k = paymentStatusKey(s); return k ? t(k as 'status.paid') : t('status.unknown'); };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6" style={{ color: 'var(--g-text)' }}>
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-xl font-bold">{t('history.title')}</h1>
        <Link to="/app/import" className="text-sm font-medium" style={{ color: 'var(--g-accent)' }}>{t('history.import')}</Link>
      </div>
      <p className="mb-4 text-sm" style={{ color: 'var(--g-text-2)' }}>{t('history.sub')}</p>

      {error && (
        <div role="alert" className="mb-4 rounded-xl border px-4 py-3 text-sm" style={{ background: 'var(--g-bad-bg)', color: 'var(--g-bad)', borderColor: 'var(--g-bad-line)' }}>
          {error} <button className="ml-2 underline" onClick={() => void load(null)}>{t('fail.cta')}</button>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <p className="rounded-2xl border px-4 py-8 text-center text-sm" style={{ background: 'var(--g-card)', borderColor: 'var(--g-line)', color: 'var(--g-text-2)' }}>{t('history.empty')}</p>
      )}

      {items.length > 0 && (
        <ul className="overflow-hidden rounded-2xl border" style={{ background: 'var(--g-card)', borderColor: 'var(--g-line)' }}>
          {items.map((p) => {
            const fiscal = safeReceiptUrl(p.receiptUrl);
            const own = safeOwnReceipt(p.ownReceiptPath);
            return (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b last:border-b-0" style={{ borderColor: 'var(--g-line)' }}>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{paymentTitle(p, titles)}</div>
                  <div className="text-xs" style={{ color: 'var(--g-text-3)' }}>
                    {srcLabel(p)} · {formatPaymentDate(p.paidAt ?? p.createdAt, LOCALE_TAG[locale] ?? 'en-GB')}
                    {p.endsAt && <> · {t('plus.until')} {formatPaymentDate(p.endsAt, LOCALE_TAG[locale] ?? 'en-GB')}</>}
                  </div>
                  {p.needsAttention && <div className="text-xs mt-0.5" style={{ color: 'var(--g-warn)' }}>{t('support.review')}</div>}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={TONE[statusTone(p.status)]}>{statusText(p.status)}</span>
                  {p.amountUzs > 0 && <span className="text-sm font-semibold">{som(p.amountUzs)}</span>}
                  {own && <button type="button" onClick={() => void api<Receipt>(own).then((r) => setReceipt({ ...r, source: p.source, title: paymentTitle(p, titles) })).catch((e) => setError(errOr(e, t('err.generic'))))} className="text-xs underline" style={{ color: 'var(--g-accent)' }}>{t('history.ourReceipt')}</button>}
                  {fiscal && <a href={fiscal} target="_blank" rel="noopener noreferrer" className="text-xs underline" style={{ color: 'var(--g-accent)' }}>{t('history.ofd')}</a>}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {loading && <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--g-text-3)' }} /></div>}
      {!loading && cursor && (
        <button className="mt-4 w-full rounded-xl border py-2 text-sm" style={{ borderColor: 'var(--g-line)' }} onClick={() => void load(cursor)}>{t('history.more')}</button>
      )}
      {receipt && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{ background: 'var(--g-overlay)' }} onClick={() => setReceipt(null)}>
          <div className="w-full max-w-sm rounded-[20px] border p-5 space-y-2 text-sm" style={{ background: 'var(--g-card)', borderColor: 'var(--g-line)' }} onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold">{t('history.ourReceipt')} · {receipt.receiptNo}</h3>
            <p>{receipt.title}</p>
            <p>{t('rc.seller')}: {PAY_SELLER[locale as keyof typeof PAY_SELLER] ?? receipt.seller}</p>
            <p>{t('history.amount')}: <b>{som(receipt.amountUzs)}</b></p>
            {receipt.paidAt && <p>{t('history.date')}: {formatPaymentDate(receipt.paidAt, LOCALE_TAG[locale] ?? 'en-GB')}</p>}
            <p>{t('history.status')}: {statusText(receipt.status)} · {srcLabel(receipt)}</p>
            {safeReceiptUrl(receipt.fiscalReceiptUrl) && <a className="underline" style={{ color: 'var(--g-accent)' }} href={safeReceiptUrl(receipt.fiscalReceiptUrl)!} target="_blank" rel="noopener noreferrer">{t('history.ofd')}</a>}
            <p className="text-xs" style={{ color: 'var(--g-text-2)' }}>{t('trust.refund')}</p>
            <button type="button" className="w-full min-h-[44px] rounded-xl border font-semibold" style={{ borderColor: 'var(--g-line)' }} onClick={() => setReceipt(null)}>OK</button>
          </div>
        </div>
      )}
      <div className="mt-6"><PayTrust /></div>
    </div>
  );
}
