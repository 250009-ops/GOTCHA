// Plus pass on the web (PAYMENTS §14, PLUS-OFFER.md §4). One-off 30/365 days, no auto-renew, behind WEB_PLUS_PASS.
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Loader2, Lock, Zap } from 'lucide-react';
import { api } from '../lib/api';
import { applyPayment, preApplyPayment, retryOtp, cancelPayment } from '../lib/importBilling';
import { CardForm, OtpForm, PayTrust, PriceTag, CancelConfirm, CancelOutcome, runCancel, usePay } from '../components/payments';
import { cancelScreen, plusBullets, plusFill, plusHeadline, plusLead, plusLookupsBullet, plusOfertaConsent, plusLegalHref, plusPayGate, plusSmallPrint } from '@gotcha/shared';
import { MARKETING_URL } from '../lib/links';

type Offer = { enabled: boolean; plans: { days: number; priceUzs: number }[]; active: boolean; expiresAt: string | null; playActive?: boolean;
  /** Admin config (plan aiDailyQuota, platform Free default, plus.benefits.importDiscountPct). */
  limits?: { plusLookups: number | null; freeLookups: number; plusQuizzes?: number; freeQuizzes?: number; freeMashq?: number; plusMashq?: number | null; importDiscountPct: number } };
type Step = 'offer' | 'card' | 'otp';

/** Extend rule (13:43): new end = max(now, current end) + N days. */
export function extendedEnd(currentEnd: string | null, days: number, now = Date.now()) {
  const base = Math.max(now, currentEnd ? Date.parse(currentEnd) : 0);
  return new Date(base + days * 86_400_000);
}

const fmtDate = (d: Date | string) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(d)).replace(/\//g, '.');

export default function PlusPage() {
  const { t, som, errOr, locale } = usePay();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [days, setDays] = useState(searchParams.get('days') === '30' ? 30 : 365);
  const [step, setStep] = useState<Step>('offer');
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [pan, setPan] = useState(''); const [exp, setExp] = useState(''); const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [ofertaOk, setOfertaOk] = useState(false); // G1: required, UNTICKED by default
  const [cancelOutcome, setCancelOutcome] = useState<{ status: string; code: string | null; needsAttention: boolean } | null>(null);
  const busy = useRef(false); // double-click guard

  useEffect(() => { api<Offer>('/billing/plus/offer').then(setOffer).catch((e) => setError(errOr(e, t('err.generic')))); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const guard = async (fn: () => Promise<void>) => {
    if (busy.current) return; busy.current = true; setLoading(true); setError(null);
    try { await fn(); } catch (e) { setError(errOr(e, t('err.generic'))); } finally { busy.current = false; setLoading(false); }
  };
  const plan = offer?.plans.find((p) => p.days === days);
  const p30 = offer?.plans.find((p) => p.days === 30);
  const savePct = p30 && plan && days === 365 ? Math.round((1 - plan.priceUzs / (12 * p30.priceUzs)) * 100) : null;

  const nums = { plus: offer?.limits?.plusLookups ?? 0, free: offer?.limits?.freeLookups ?? 0, pct: offer?.limits?.importDiscountPct ?? 0, plusQ: offer?.limits?.plusQuizzes ?? 0, freeQ: typeof offer?.limits?.freeMashq === 'number' ? offer.limits.freeMashq : 20 };
  // plusLookups null = no daily limit (Marketing PLUS-OFFER §4 copy); a configured number uses the {plus} templates.
  const plusCap = offer?.limits ? offer.limits.plusLookups ?? null : null;
  const tf = (k: Parameters<typeof t>[0]) => (plusCap == null && nums.free > 0 && k === 'plus.b1' ? plusLookupsBullet(null, nums.free, locale)
    : plusCap == null && nums.free > 0 && k === 'plus.lead' ? plusLead(null, nums.free, locale) : plusFill(t(k), nums));
  const lookupsCopy = nums.free > 0 && (plusCap == null || nums.plus > 0);
  const start = () => guard(async () => {
    if (!ofertaOk) return; // G1: never start a checkout without the Public Offer
    const r = await api<{ paymentId: string }>('/billing/plus/checkout', { method: 'POST', body: JSON.stringify({ days, acceptOferta: ofertaOk }) });
    setPaymentId(r.paymentId); setStep('card');
  });
  const submitCard = () => guard(async () => {
    const r = await preApplyPayment(paymentId!, pan.replace(/\s/g, ''), exp.replace(/\//g, ''));
    if (r.step === 'otp') { setOtp(''); setStep('otp'); }
  });
  const submitOtp = () => guard(async () => {
    const r = await applyPayment(paymentId!, otp);
    if (r.step === 'paid') navigate(`/app/import/payment-return?paymentId=${paymentId}`, { replace: true });
    else if (r.step === 'otp') { setOtp(''); setError(t('err.generic')); }
    else { setStep('card'); setError(t('fail.kept')); } // card number kept on retry
  });

  if (!offer) return <div className="flex justify-center py-16">{error ? <p role="alert" style={{ color: 'var(--g-bad)' }}>{error}</p> : <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--g-text-3)' }} />}</div>;

  const oc = plusOfertaConsent(locale);
  const gate = plusPayGate({ accepted: ofertaOk, hasPlan: !!plan, loading });
  const box = { background: 'var(--g-card)', borderColor: 'var(--g-line)', color: 'var(--g-text)' } as const;
  const stepNo = step === 'offer' ? 1 : step === 'card' ? 2 : 3;
  const itemLabel = days === 365 ? t('plus.item365') : t('plus.item30');
  return (
    <div className="mx-auto w-full max-w-5xl px-3 sm:px-6 py-5 lg:py-8 space-y-5" style={{ color: 'var(--g-text)' }}>
      {offer.active && offer.expiresAt && (
        <div className="rounded-2xl border px-4 py-3.5 flex items-center gap-3" style={box}>
          <span className="size-9 rounded-[10px] grid place-items-center shrink-0" style={{ background: 'var(--g-cta)' }}><Zap className="w-4 h-4 text-[var(--g-on-cta)]" aria-hidden /></span>
          <div className="min-w-0">
            <p className="font-bold">{t('plus.stActive')}</p>
            <p className="text-sm" style={{ color: 'var(--g-text-2)' }}>{t('plus.until')} {fmtDate(offer.expiresAt)} · {Math.max(0, Math.ceil((Date.parse(offer.expiresAt) - Date.now()) / 86_400_000))} {t('plus.stLeft')}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--g-text-3)' }}>{offer.playActive ? t('plus.stPlay') : t('plus.stSource')}</p>
          </div>
        </div>
      )}

      {offer.playActive ? null : !offer.enabled ? (
        <p className="rounded-2xl border p-4 text-sm" style={box}>{t('err.plusUnavailable')}</p>
      ) : step === 'offer' ? (
        <div className="grid lg:grid-cols-[minmax(0,1fr)_400px] gap-6 lg:gap-8 items-start">
          <div className="min-w-0 space-y-4">
            <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11.5px] font-extrabold tracking-[0.14em]" style={{ background: 'var(--g-accent-soft)', color: 'var(--g-accent)' }}>
              <Zap className="w-3.5 h-3.5" aria-hidden />GOTCHA PLUS
            </span>
            <h1 className="text-[26px] sm:text-[34px] leading-[1.1] font-extrabold tracking-tight">{offer.active ? t('plus.extTitle') : plusHeadline(plusCap, locale)}</h1>
            {lookupsCopy && <p className="text-[15px] leading-relaxed" data-testid="plus-lead">{tf('plus.lead')}</p>}
            <p className="text-sm leading-relaxed" style={{ color: 'var(--g-text-2)' }}>{t('plus.sub')}</p>
            <ul className="rounded-2xl border divide-y overflow-hidden" style={{ ...box, borderColor: 'var(--g-line)' }}>
              {/* 10 / 10b (+imports) / 10c (+quizzes, only with imports) enforced in plusBullets; numbers from config. */}
              {plusBullets(nums.pct, nums.plusQ > 0 && nums.freeQ > 0).filter((k) => k !== 'plus.b1' || lookupsCopy).map((k) => (
                <li key={k} className="flex gap-3 px-4 py-3.5 text-sm leading-snug" style={{ borderColor: 'var(--g-line)' }} data-testid={`bullet-${k}`}>
                  <span className="size-6 rounded-full grid place-items-center shrink-0" style={{ background: 'var(--g-ok-bg)' }}><Check className="w-3.5 h-3.5" style={{ color: 'var(--g-ok)' }} aria-hidden /></span>
                  <span className="pt-0.5">{tf(k)}</span>
                </li>
              ))}
            </ul>
          </div>

          <aside className="rounded-[20px] border p-5 space-y-4 lg:sticky lg:top-4 shadow-[0_12px_32px_rgba(16,24,40,0.07)]" style={box}>
            <div role="radiogroup" className="space-y-2.5">
              {offer.plans.map((p) => {
                const on = days === p.days;
                return (
                  <button key={p.days} type="button" role="radio" aria-checked={on} onClick={() => setDays(p.days)}
                    className="w-full rounded-2xl border-[1.5px] px-4 py-3.5 text-left min-h-[44px] flex items-center gap-3 transition-shadow"
                    style={{ ...box, borderColor: on ? 'var(--g-accent)' : 'var(--g-line-input)', background: on ? 'var(--g-accent-soft)' : 'var(--g-card)' }}>
                    <span className="size-5 rounded-full shrink-0" style={{ border: on ? '6px solid var(--g-accent)' : '2px solid var(--g-line-input)' }} aria-hidden />
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2 text-[15px] font-bold">
                        {p.days === 365 ? t('plus.o365') : t('plus.o30')}
                        {p.days === 365 && savePct != null && savePct > 0 && <span className="text-[11px] font-bold rounded-md px-1.5 py-0.5" style={{ background: 'var(--g-ok-bg)', color: 'var(--g-ok)' }}>−{savePct}%</span>}
                      </span>
                      {p.days === 365 && p30 && <span className="block text-xs mt-0.5" style={{ color: 'var(--g-text-2)' }}>≈ {som(Math.round(p.priceUzs / 12))}</span>}
                    </span>
                    <PriceTag amountUzs={p.priceUzs} />
                  </button>
                );
              })}
            </div>
            {offer.active && (
              <p className="text-sm rounded-xl px-3.5 py-3" style={{ background: 'var(--g-card-2)', color: 'var(--g-text-2)' }}>{t('plus.extNew')}: <b style={{ color: 'var(--g-text)' }}>{fmtDate(extendedEnd(offer.expiresAt, days))}</b>. {t('plus.extNote')}</p>
            )}
            {error && <p role="alert" className="text-sm" style={{ color: 'var(--g-bad)' }}>{error}</p>}
            <label className="flex items-start gap-2.5 text-[13px] leading-relaxed cursor-pointer" data-testid="oferta-consent">
              <input type="checkbox" required checked={ofertaOk} onChange={(e) => setOfertaOk(e.target.checked)} className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[var(--g-cta)]" data-testid="oferta-checkbox" aria-describedby={gate.needsOferta ? 'oferta-hint' : undefined} />
              <span>{oc.parts.map((p, i) => p.href
                ? <a key={i} href={plusLegalHref(MARKETING_URL, p.href, locale)} target="_blank" rel="noopener noreferrer" className="underline font-semibold" style={{ color: 'var(--g-accent)' }} data-testid={p.href === '/oferta' ? 'oferta-link' : `legal-link-${p.href.slice(1)}`}>{p.text}</a>
                : <span key={i}>{p.text}</span>)}</span>
            </label>
            <button type="button" disabled={gate.disabled} onClick={start} data-testid="plus-pay" className="w-full min-h-[50px] rounded-[13px] font-bold text-[var(--g-on-cta)] disabled:opacity-50 inline-flex items-center justify-center gap-2 shadow-[0_8px_20px_var(--g-brand-shadow)] disabled:shadow-none" style={{ background: 'var(--g-cta)' }}>
              {loading ? <Loader2 className="inline w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" aria-hidden />} {plan ? `${t('pay.amount')} ${som(plan.priceUzs)}` : t('plus.cta')}
            </button>
            {gate.needsOferta && <p id="oferta-hint" className="text-xs text-center" style={{ color: 'var(--g-text-2)' }} data-testid="oferta-hint">{oc.hint}</p>}
            <p className="text-[12px] leading-relaxed" style={{ color: 'var(--g-text-3)' }}>{t('plus.noRenew')} {plusSmallPrint(t('plus.small'), nums.pct)}</p>
          </aside>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-5 lg:gap-6 items-start max-w-4xl mx-auto">
          <section className="rounded-[20px] border p-5 sm:p-7 space-y-5" style={box}>
            <div className="flex gap-1.5" aria-hidden>
              {[1, 2, 3].map((n) => <span key={n} className="h-1 flex-1 rounded-full" style={{ background: n <= stepNo ? 'var(--g-cta)' : 'var(--g-track)' }} />)}
            </div>
            <h2 className="text-xl font-bold">{step === 'card' ? t('card.title') : t('otp.title')}</h2>
            {step === 'card' && <CardForm pan={pan} exp={exp} onPan={setPan} onExp={setExp} onSubmit={submitCard} amountUzs={plan?.priceUzs ?? 0} loading={loading} error={error} onCancel={() => setConfirmCancel(true)} />}
            {step === 'otp' && <OtpForm cardMask={pan} otp={otp} onOtp={setOtp} onSubmit={submitOtp} onResend={() => void guard(async () => { await retryOtp(paymentId!); })} loading={loading} error={error} onCancel={() => setConfirmCancel(true)} />}
          </section>
          <aside className="rounded-[20px] border p-5 space-y-3 order-first lg:order-none" style={box}>
            <div className="flex items-center gap-3">
              <span className="size-10 rounded-[11px] grid place-items-center shrink-0" style={{ background: 'var(--g-cta)' }}><Zap className="w-[18px] h-[18px] text-[var(--g-on-cta)]" aria-hidden /></span>
              <p className="text-sm font-semibold flex-1 min-w-0">{itemLabel}</p>
            </div>
            <div className="flex items-baseline justify-between border-t pt-3" style={{ borderColor: 'var(--g-line)' }}>
              <span className="text-sm" style={{ color: 'var(--g-text-2)' }}>{t('history.amount')}</span>
              {plan && <PriceTag amountUzs={plan.priceUzs} big />}
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--g-text-3)' }}>{t('plus.noRenew')}</p>
          </aside>
        </div>
      )}
      <PayTrust plus />
      <CancelConfirm open={confirmCancel} busy={loading} summary={plan ? <><span className="min-w-0 truncate">{itemLabel}</span><b className="shrink-0">{som(plan.priceUzs)}</b></> : undefined} onKeep={() => setConfirmCancel(false)} onConfirm={() => void guard(async () => {
        setConfirmCancel(false);
        if (paymentId) {
          const r = await runCancel(() => cancelPayment(paymentId, 'learner_cancel'));
          if (cancelScreen(r) !== '06') { setCancelOutcome(r); return; }
        }
        setPaymentId(null); setStep('offer'); setOtp('');
      })} />
      {cancelOutcome && <div className="rounded-[20px] border p-6 sm:p-8 max-w-md mx-auto" style={box}><CancelOutcome outcome={cancelOutcome} reference={paymentId} needsAttention={cancelOutcome.needsAttention} onDone={() => { setCancelOutcome(null); setPaymentId(null); setStep('offer'); setOtp(''); }} /></div>}
    </div>
  );
}
