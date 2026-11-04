// Shared payment UI (PAYMENTS.md §7/§13). Dark mode via --g-* tokens only. No logos: text badges only.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, Loader2, Lock, XCircle, AlertTriangle } from 'lucide-react';
import { PAY_ERROR_KEYS, PAY_OFERTA_URL, PAY_SELLER, cancelScreen, cardBrand, payCopyFor, payErrorText, payFill, paySom, type PayKey } from '@gotcha/shared';
import { useLearnerLocale } from '../../lib/learnerLocaleContext';

export function usePay() {
  const { locale } = useLearnerLocale();
  const t = payCopyFor(locale);
  return {
    locale,
    t: (k: PayKey) => t[k],
    som: (n: number) => paySom(n, locale),
    err: (e: unknown) => payErrorText((e as { code?: string } | null)?.code ?? null, locale),
    /** Known API/Atmos code → localized copy; otherwise the server message, otherwise the fallback. */
    errOr: (e: unknown, fallback: string) => {
      const code = (e as { code?: string } | null)?.code;
      if ((e as { limit?: number }).limit && e instanceof Error && e.message) return e.message;
      if (code && PAY_ERROR_KEYS[code]) return payErrorText(code, locale);
      return e instanceof Error && e.message ? e.message : fallback;
    },
  };
}

const card = { background: 'var(--g-card)', color: 'var(--g-text)', borderColor: 'var(--g-line)' } as const;
const muted = { color: 'var(--g-text-2)' } as const;

/** Trust block on every payment surface: secure line, text badge, support, refund rule. */
/** plus: Plus checkout uses the Plus refund sentence (trust.refundPlus); imports/books use the generic one. */
export function PayTrust({ refund = true, plus = false }: { refund?: boolean; plus?: boolean }) {
  const { t, locale } = usePay();
  return (
    <div className="w-full rounded-2xl border px-4 py-3.5 text-[12.5px] leading-5 space-y-2" style={{ ...muted, borderColor: 'var(--g-line)', background: 'var(--g-card)' }} data-testid="pay-trust">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="flex items-center gap-1.5 font-semibold" style={{ color: 'var(--g-text)' }}><Lock className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--g-ok)' }} aria-hidden />{t('trust.secure')}</p>
        <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-bold tracking-wide" style={{ background: 'var(--g-accent-soft)', color: 'var(--g-accent)' }}>{t('trust.cards')}</span>
      </div>
      <p>
        {t('trust.support')}
        {PAY_OFERTA_URL && <>{' · '}<a href={PAY_OFERTA_URL} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'var(--g-accent)' }}>{t('oferta')}</a></>}
      </p>
      <p data-testid="pay-seller">{t('rc.seller')}: {PAY_SELLER[locale as keyof typeof PAY_SELLER] ?? PAY_SELLER.en}</p>
      {refund && <p className="text-[12px]" style={{ color: 'var(--g-text-3)' }}>{t(plus ? 'trust.refundPlus' : 'trust.refund')}</p>}
      <p data-testid="pay-no-refund" className="text-[12px]" style={{ color: 'var(--g-text-3)' }}>{t('trust.noRefund')}</p>
    </div>
  );
}

export function PriceTag({ amountUzs, listUzs, big }: { amountUzs: number; listUzs?: number | null; big?: boolean }) {
  const { som } = usePay();
  if (!(amountUzs > 0)) return null; // never render "0 soʻm"
  return (
    <span className={`font-extrabold whitespace-nowrap ${big ? 'text-[22px]' : 'text-base'}`} style={{ color: 'var(--g-text)' }}>
      {listUzs && listUzs > amountUzs && <s className="mr-2 font-semibold text-sm" style={{ color: 'var(--g-text-3)' }}>{som(listUzs)}</s>}
      {som(amountUzs)}
    </span>
  );
}

const inputCls = 'w-full px-4 h-12 rounded-[12px] border text-base outline-none focus:ring-4 focus:ring-[var(--g-accent-soft)] focus:border-[var(--g-focus)] disabled:opacity-50';
const inputStyle = { background: 'var(--g-input)', color: 'var(--g-text)', borderColor: 'var(--g-line-input)' } as const;

export const formatPan = (v: string) => v.replace(/\D/g, '').slice(0, 19).replace(/(.{4})/g, '$1 ').trim();
export const formatExp = (v: string) => { const d = v.replace(/\D/g, '').slice(0, 4); return d.length >= 3 ? `${d.slice(0, 2)}/${d.slice(2)}` : d; };
export function cardFormOk(pan: string, exp: string) {
  const d = pan.replace(/\D/g, ''); const e = exp.replace(/\D/g, '');
  return d.length >= 16 && d.length <= 19 && e.length === 4 && +e.slice(0, 2) >= 1 && +e.slice(0, 2) <= 12;
}

/** Card number + MM/YY (no CVV: Uzcard/Humo). The amount is on the button. */
function CancelLink({ onCancel, disabled }: { onCancel?: () => void; disabled?: boolean }) {
  const { t } = usePay();
  if (!onCancel) return null;
  return (
    <button type="button" onClick={onCancel} disabled={disabled} data-testid="pay-cancel-link"
      className="w-full min-h-[44px] text-sm font-extrabold disabled:opacity-50" style={{ color: 'var(--g-accent)' }}>{t('summary.cancel')}</button>
  );
}

export function CardForm({ pan, exp, onPan, onExp, onSubmit, amountUzs, loading, error, onCancel }: {
  pan: string; exp: string; onPan: (v: string) => void; onExp: (v: string) => void; onSubmit: () => void;
  amountUzs: number; loading?: boolean; error?: string | null; onCancel?: () => void;
}) {
  const { t, som } = usePay();
  const brand = cardBrand(pan);
  const ok = cardFormOk(pan, exp);
  return (
    <form className="w-full space-y-4" onSubmit={(e) => { e.preventDefault(); if (ok && !loading) onSubmit(); }}>
      <p className="text-sm" style={muted}>{t('card.noCvv')}</p>
      <div>
        <label htmlFor="pay-pan" className="block text-xs font-semibold mb-1.5" style={muted}>{t('card.number')}</label>
        <div className="relative">
          <input id="pay-pan" type="text" inputMode="numeric" autoComplete="cc-number" value={pan} disabled={loading}
            onChange={(e) => onPan(formatPan(e.target.value))} placeholder="0000 0000 0000 0000"
            className={`${inputCls} font-mono tracking-wider pr-20`} style={inputStyle} />
          {brand && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-extrabold tracking-wide px-2 py-1 rounded-md" style={{ background: 'var(--g-accent-soft)', color: 'var(--g-accent)' }}>{brand === 'humo' ? t('card.detectedHumo') : t('card.detected')}</span>}
        </div>
      </div>
      <div>
        <label htmlFor="pay-exp" className="block text-xs font-semibold mb-1.5" style={muted}>{t('card.expiry')}</label>
        <input id="pay-exp" type="text" inputMode="numeric" autoComplete="cc-exp" value={exp} disabled={loading}
          onChange={(e) => onExp(formatExp(e.target.value))} placeholder="MM/YY" className={`${inputCls} font-mono`} style={inputStyle} />
      </div>
      <p className="text-[13px] rounded-xl px-3.5 py-3" style={{ background: 'var(--g-accent-soft)', color: 'var(--g-text)' }}>{t('card.handoff')}</p>
      {error && <p role="alert" className="text-sm" style={{ color: 'var(--g-bad)' }}>{error}</p>}
      <PayButton disabled={!ok} loading={loading} label={`${t('pay.amount')} ${som(amountUzs)}`} />
      <CancelLink onCancel={onCancel} disabled={loading} />
    </form>
  );
}

export function PayButton({ label, disabled, loading, onClick, type = 'submit' }: { label: string; disabled?: boolean; loading?: boolean; onClick?: () => void; type?: 'submit' | 'button' }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled || loading} aria-busy={loading}
      className="w-full min-h-[50px] rounded-[13px] font-bold text-[var(--g-on-cta)] disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_8px_20px_var(--g-brand-shadow)] disabled:shadow-none"
      style={{ background: 'var(--g-cta)' }}>
      {loading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}{label}
    </button>
  );
}

/** SMS step: masked CARD (Atmos returns no phone), one-time-code, resend after 30 s. */
export function OtpForm({ cardMask, otp, onOtp, onSubmit, onResend, loading, error, onCancel }: {
  cardMask: string; otp: string; onOtp: (v: string) => void; onSubmit: () => void; onResend: () => void; loading?: boolean; error?: string | null; onCancel?: () => void;
}) {
  const { t } = usePay();
  const [left, setLeft] = useState(30);
  useEffect(() => { if (left <= 0) return; const id = setTimeout(() => setLeft((s) => s - 1), 1000); return () => clearTimeout(id); }, [left]);
  const ok = /^\d{4,8}$/.test(otp);
  return (
    <form className="w-full space-y-4" onSubmit={(e) => { e.preventDefault(); if (ok && !loading) onSubmit(); }}>
      <p className="text-sm" style={muted}>{payFill(t('otp.sentTo'), { mask: cardMask })}</p>
      <label htmlFor="pay-otp" className="block text-xs font-semibold" style={muted}>{t('otp.code')}</label>
      <input id="pay-otp" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={otp} disabled={loading}
        onChange={(e) => onOtp(e.target.value.replace(/\D/g, '').slice(0, 8))}
        className={`${inputCls} text-center font-mono tracking-[.3em] text-xl`} style={inputStyle} />
      {error && <p role="alert" className="text-sm" style={{ color: 'var(--g-bad)' }}>{error}</p>}
      <PayButton disabled={!ok} loading={loading} label={t('otp.confirm')} />
      <button type="button" disabled={left > 0 || loading} onClick={() => { setLeft(30); onResend(); }}
        className="w-full min-h-[44px] text-sm font-semibold disabled:opacity-60" style={{ color: 'var(--g-accent)' }}>
        {left > 0 ? payFill(t('otp.resendIn'), { seconds: left }) : t('otp.resend')}
      </button>
      <CancelLink onCancel={onCancel} disabled={loading} />
    </form>
  );
}

export function PayResult({ tone, title, body, reference, children }: { tone: 'ok' | 'bad' | 'neutral'; title: string; body?: ReactNode; reference?: string | null; children?: ReactNode }) {
  const { t } = usePay();
  const Icon = tone === 'ok' ? CheckCircle2 : tone === 'bad' ? XCircle : AlertTriangle;
  const color = tone === 'ok' ? 'var(--g-ok)' : tone === 'bad' ? 'var(--g-bad)' : 'var(--g-text-3)';
  return (
    <div className="flex flex-col items-center text-center gap-3 w-full" role={tone === 'bad' ? 'alert' : 'status'} aria-live="polite">
      <span className="size-16 rounded-full grid place-items-center" style={{ background: tone === 'ok' ? 'var(--g-ok-bg)' : tone === 'bad' ? 'var(--g-bad-bg)' : 'var(--g-card-2)' }}>
        <Icon className="w-8 h-8" strokeWidth={2.5} style={{ color }} aria-hidden data-testid={`pay-result-icon-${tone}`} />
      </span>
      <h2 className="text-xl font-bold" style={{ color: 'var(--g-text)' }}>{title}</h2>
      {body && <div className="text-sm" style={muted}>{body}</div>}
      {reference && <p className="text-xs" style={{ color: 'var(--g-text-3)' }}>{t('pending.ref')}: <span className="font-mono">{reference}</span></p>}
      {children}
    </div>
  );
}

/** Polling schedule (PAYMENTS §6): every 2 s for 20 s, then every 10 s up to 2 min. */
export function pollDelayMs(elapsedMs: number): number | null {
  if (elapsedMs < 20_000) return 2_000;
  if (elapsedMs < 120_000) return 10_000;
  return null;
}

export type PolledStatus = { status: string; needsAttention?: boolean };

export function usePaymentPolling(fetchStatus: () => Promise<PolledStatus>, enabled: boolean) {
  const [state, setState] = useState<{ status: string; slow: boolean; done: boolean; needsAttention: boolean }>({ status: 'pending', slow: false, done: false, needsAttention: false });
  const startedRef = useRef(Date.now());
  const fetchRef = useRef(fetchStatus); fetchRef.current = fetchStatus;
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let alive = true; let timer: ReturnType<typeof setTimeout> | undefined;
    const run = async () => {
      const r = await fetchRef.current().catch(() => null);
      if (!alive) return;
      const elapsed = Date.now() - startedRef.current;
      const final = r && r.status !== 'pending';
      setState({ status: r?.status ?? 'pending', slow: elapsed >= 20_000, done: !!final, needsAttention: !!r?.needsAttention });
      const next = pollDelayMs(elapsed);
      if (!final && next != null) timer = setTimeout(run, next);
      else if (!final) setState((s) => ({ ...s, slow: true, done: false }));
    };
    void run();
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, [enabled, tick]);
  return { ...state, checkAgain: () => { startedRef.current = Date.now() - 20_000; setTick((n) => n + 1); } };
}

export function PayPending({ slow, reference, needsAttention, onCheckAgain }: { slow: boolean; reference?: string | null; needsAttention?: boolean; onCheckAgain: () => void }) {
  const { t } = usePay();
  return (
    <div className="flex flex-col items-center text-center gap-3 w-full" role="status" aria-live="polite">
      <Loader2 className="w-12 h-12 animate-spin" style={{ color: 'var(--g-accent)' }} aria-hidden />
      <h2 className="text-xl font-bold" style={{ color: 'var(--g-text)' }}>{t('pending.title')}</h2>
      <p className="text-sm" style={muted}>{t('pending.sub')}</p>
      {slow && (
        <div className="w-full rounded-xl p-3 text-sm text-left" style={{ background: 'var(--g-streak-bg)', color: 'var(--g-streak-text)' }}>
          <p>{t('pending.slow')}</p>
          <button type="button" onClick={onCheckAgain} className="mt-2 font-bold underline">{t('pending.check')}</button>
        </div>
      )}
      {needsAttention && <p className="text-sm" style={{ color: 'var(--g-warn)' }}>{t('support.review')}</p>}
      {reference && <p className="text-xs" style={{ color: 'var(--g-text-3)' }}>{t('pending.ref')}: <span className="font-mono">{reference}</span></p>}
    </div>
  );
}

/** "Cancel this payment?" confirm step before POST cancel. */
export function CancelConfirm({ open, onKeep, onConfirm, busy, summary }: { open: boolean; onKeep: () => void; onConfirm: () => void; busy?: boolean; summary?: ReactNode }) {
  const { t } = usePay();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onKeep(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onKeep]);
  if (!open) return null;
  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="pay-cancel-q" aria-describedby="pay-cancel-body" className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-[rgba(11,12,38,0.5)] backdrop-blur-[3px]">
      <div className="w-full max-w-[480px] rounded-[20px] border p-6 shadow-[0_30px_80px_rgba(11,12,38,0.35)]" style={card}>
        <div className="size-11 rounded-[12px] grid place-items-center mb-4" style={{ background: 'var(--g-bad-bg)' }}>
          <AlertTriangle className="w-5 h-5" style={{ color: 'var(--g-bad)' }} aria-hidden />
        </div>
        <h3 id="pay-cancel-q" className="text-lg font-bold">{t('cancel.confirmQ')}</h3>
        <p id="pay-cancel-body" className="text-sm mt-1.5 leading-relaxed" style={muted}>{t('cancel.reversed')}</p>
        {summary && <div className="mt-4 rounded-xl px-3.5 py-3 text-sm flex items-center justify-between gap-3" style={{ background: 'var(--g-card-2)', color: 'var(--g-text)' }}>{summary}</div>}
        <div className="grid min-[480px]:grid-cols-2 gap-2 mt-5">
          <button type="button" onClick={onKeep} autoFocus className="min-h-[46px] px-3 rounded-xl border text-sm font-semibold" style={card}>{t('cancel.keep')}</button>
          <button type="button" onClick={onConfirm} disabled={busy} className="min-h-[46px] px-3 rounded-xl text-sm font-bold disabled:opacity-50" style={{ background: 'var(--g-bad)', color: 'var(--g-on-fill)' }}>{t('cancel.yes')}</button>
        </div>
      </div>
    </div>
  );
}

/** Expired session (60 min): never reuse the id — "Start again" makes a new checkout. */
export function PayExpired({ onStartAgain }: { onStartAgain: () => void }) {
  const { t } = usePay();
  return (
    <PayResult tone="bad" title={t('fail.title')} body={<><p>{t('err.expired')}</p><p className="mt-1">{t('fail.noCharge')}</p></>}>
      <PayButton type="button" label={t('startAgain')} onClick={onStartAgain} />
    </PayResult>
  );
}

/** Cancel result screens: 06 (nothing charged), 06b (race: reversing automatically), 06c (already paid: support only, no refund button). */
export function CancelOutcome({ outcome, reference, needsAttention, onDone, doneLabel }: {
  outcome: { status?: string | null; code?: string | null }; reference?: string | null; needsAttention?: boolean; onDone: () => void; doneLabel?: string;
}) {
  const { t } = usePay();
  const screen = cancelScreen(outcome);
  if (screen === '06c') {
    return (
      <PayResult tone="neutral" title={t('pc.title')} body={t('pc.sub')} reference={reference}>
        <a href="mailto:support@gotchaa.uz" data-testid="pay-06c-support" className="w-full min-h-[48px] rounded-[14px] border font-bold flex items-center justify-center" style={{ ...card }}>{t('pc.cta')}</a>
        <p className="text-sm" style={muted}>{t('trust.refund')}</p>
      </PayResult>
    );
  }
  if (screen === '06b') {
    return (
      <PayResult tone="neutral" title={t('rev.title')} body={t('rev.sub')} reference={reference}>
        <PayButton type="button" label={t('rev.track')} onClick={onDone} />
        <p className="text-xs" style={{ color: needsAttention ? 'var(--g-warn)' : 'var(--g-text-3)' }}>{needsAttention ? t('support.review') : t('rev.stuck')}</p>
      </PayResult>
    );
  }
  return (
    <PayResult tone="neutral" title={t('cancel.title')} body={t('cancel.sub')}>
      <PayButton type="button" label={doneLabel ?? t('cancel.cta')} onClick={onDone} />
    </PayResult>
  );
}

/** Run POST cancel and turn the answer (or a 409) into a CancelOutcome input. */
export async function runCancel(cancel: () => Promise<{ status?: string; needsAttention?: boolean }>) {
  try {
    const r = await cancel();
    return { status: r?.status ?? 'cancelled', code: null as string | null, needsAttention: !!r?.needsAttention };
  } catch (e) {
    const code = (e as { code?: string })?.code ?? null;
    if (code === 'refund_requires_support') return { status: 'paid', code, needsAttention: false };
    throw e;
  }
}
