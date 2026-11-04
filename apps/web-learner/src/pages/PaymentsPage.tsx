// Payment history (PAYMENTS.md §11.4): Atmos, Google Play and admin grants; our receipt + fiscal chek. Reads GET /billing/payments.
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ExternalLink, Gift, Loader2, Receipt, Upload, Zap } from 'lucide-react';
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

  const kindIcon = (p: PaymentSummary) => (p.kind === 'plus' || p.kind === 'play' ? Zap : p.kind === 'admin_grant' ? Gift : p.kind === 'catalog' ? BookOpen : Upload);
  const kindTone = (p: PaymentSummary) => (p.kind === 'plus' || p.kind === 'play'
    ? { background: 'var(--g-accent-soft)', color: 'var(--g-accent)' }
    : p.kind === 'catalog' ? { background: 'var(--g-warn-bg)', color: 'var(--g-warn)' }
    : p.kind === 'admin_grant' ? { background: 'var(--g-ok-bg)', color: 'var(--g-ok)' }
    : { background: 'var(--g-learn-bg)', color: 'var(--g-learn)' });

  return (
    <div className="mx-auto w-full max-w-5xl px-3 sm:px-6 py-5 lg:py-8" style={{ color: 'var(--g-text)' }}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{t('history.title')}</h1>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--g-text-2)' }}>{t('history.sub')}</p>
        </div>
        <Link to="/app/import" className="inline-flex items-center gap-2 min-h-10 px-3.5 rounded-[11px] border text-sm font-semibold" style={{ borderColor: 'var(--g-line)', background: 'var(--g-card)', color: 'var(--g-text)' }}>
          <Upload className="w-4 h-4" aria-hidden />{t('history.import')}
        </Link>
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-xl border px-4 py-3 text-sm" style={{ background: 'var(--g-bad-bg)', color: 'var(--g-bad)', borderColor: 'var(--g-bad-line)' }}>
          {error} <button className="ml-2 underline" onClick={() => void load(null)}>{t('fail.cta')}</button>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="rounded-2xl border px-4 py-12 text-center text-sm flex flex-col items-center gap-3" style={{ background: 'var(--g-card)', borderColor: 'var(--g-line)', color: 'var(--g-text-2)' }}>
          <span className="size-12 rounded-full grid place-items-center" style={{ background: 'var(--g-accent-soft)', color: 'var(--g-accent)' }}><Receipt className="w-5 h-5" aria-hidden /></span>
          {t('history.empty')}
        </div>
      )}

      {items.length > 0 && (
        <div className="overflow-hidden rounded-2xl border" style={{ background: 'var(--g-card)', borderColor: 'var(--g-line)' }}>
          <div className="hidden md:grid grid-cols-[minmax(0,1fr)_150px_110px_120px_190px] gap-4 px-5 h-10 items-center text-[11px] font-semibold uppercase tracking-[0.06em] border-b" style={{ color: 'var(--g-text-3)', borderColor: 'var(--g-line)', background: 'var(--g-card-2)' }}>
            <span>{t('history.item')}</span><span>{t('history.date')}</span><span>{t('history.status')}</span><span className="text-right">{t('history.amount')}</span><span className="text-right">{t('history.receipt')}</span>
          </div>
          <ul>
            {items.map((p) => {
              const fiscal = safeReceiptUrl(p.receiptUrl);
              const own = safeOwnReceipt(p.ownReceiptPath);
              const Icon = kindIcon(p);
              return (
                <li key={p.id} className="grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1fr)_150px_110px_120px_190px] gap-x-4 gap-y-1.5 items-center px-4 md:px-5 py-3.5 border-b last:border-b-0" style={{ borderColor: 'var(--g-line)' }}>
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="size-9 rounded-[10px] grid place-items-center shrink-0" style={kindTone(p)}><Icon className="w-4 h-4" aria-hidden /></span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{paymentTitle(p, titles)}</div>
                      <div className="text-xs truncate" style={{ color: 'var(--g-text-3)' }}>
                        {srcLabel(p)}
                        <span className="md:hidden"> · {formatPaymentDate(p.paidAt ?? p.createdAt, LOCALE_TAG[locale] ?? 'en-GB')}</span>
                        {p.endsAt && <> · {t('plus.until')} {formatPaymentDate(p.endsAt, LOCALE_TAG[locale] ?? 'en-GB')}</>}
                      </div>
                      {p.needsAttention && <div className="text-xs mt-0.5" style={{ color: 'var(--g-warn)' }}>{t('support.review')}</div>}
                    </div>
                  </div>
                  <span className="hidden md:block text-[13px]" style={{ color: 'var(--g-text-2)' }}>{formatPaymentDate(p.paidAt ?? p.createdAt, LOCALE_TAG[locale] ?? 'en-GB')}</span>
                  <span className="justify-self-end md:justify-self-start rounded-md px-2 py-0.5 text-[11.5px] font-semibold whitespace-nowrap" style={TONE[statusTone(p.status)]}>{statusText(p.status)}</span>
                  <span className="col-start-2 row-start-1 md:col-start-auto md:row-start-auto text-sm font-bold text-right whitespace-nowrap tabular-nums">{p.amountUzs > 0 ? som(p.amountUzs) : ''}</span>
                  <div className="col-span-2 md:col-span-1 flex items-center justify-start md:justify-end gap-3 pl-12 md:pl-0">
                    {own && <button type="button" onClick={() => void api<Receipt>(own).then((r) => setReceipt({ ...r, source: p.source, title: paymentTitle(p, titles) })).catch((e) => setError(errOr(e, t('err.generic'))))} className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: 'var(--g-accent)' }}><Receipt className="w-3.5 h-3.5" aria-hidden />{t('history.ourReceipt')}</button>}
                    {fiscal && <a href={fiscal} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: 'var(--g-accent)' }}><ExternalLink className="w-3.5 h-3.5" aria-hidden />{t('history.ofd')}</a>}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {loading && <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--g-text-3)' }} /></div>}
      {!loading && cursor && (
        <button className="mt-4 w-full min-h-11 rounded-xl border text-sm font-semibold" style={{ borderColor: 'var(--g-line)', background: 'var(--g-card)' }} onClick={() => void load(cursor)}>{t('history.more')}</button>
      )}
      {receipt && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-[rgba(11,12,38,0.5)] backdrop-blur-[3px]" onClick={() => setReceipt(null)}>
          <div className="w-full max-w-sm rounded-[20px] border p-6 space-y-2 text-sm shadow-[0_30px_80px_rgba(11,12,38,0.35)]" style={{ background: 'var(--g-card)', borderColor: 'var(--g-line)' }} onClick={(e) => e.stopPropagation()}>
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
