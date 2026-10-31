// Plus pass on the web (PAYMENTS §14, PLUS-OFFER.md §4). One-off 30/365 days, no auto-renew, behind WEB_PLUS_PASS.
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { applyPayment, preApplyPayment, retryOtp, cancelPayment } from '../lib/importBilling';
import { CardForm, OtpForm, PayTrust, PriceTag, CancelConfirm, CancelOutcome, runCancel, usePay } from '../components/payments';
import { cancelScreen, plusBullets, plusFill, plusHeadline, plusLead, plusLookupsBullet, plusOfertaConsent, plusLegalHref, plusPayGate, plusSmallPrint } from '@gotcha/shared';
import { MARKETING_URL } from '../lib/links';

type Offer = { enabled: boolean; plans: { days: number; priceUzs: number }[]; active: boolean; expiresAt: string | null; playActive?: boolean;
  /** Admin config (plan aiDailyQuota, platform Free default, plus.benefits.importDiscountPct). */
  limits?: { plusLookups: number | null; freeLookups: number; plusQuizzes?: number; freeQuizzes?: number; importDiscountPct: number } };
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

  const nums = { plus: offer?.limits?.plusLookups ?? 0, free: offer?.limits?.freeLookups ?? 0, pct: offer?.limits?.importDiscountPct ?? 0, plusQ: offer?.limits?.plusQuizzes ?? 0, freeQ: offer?.limits?.freeQuizzes ?? 0 };
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
  return (
    <div className="mx-auto w-full max-w-md px-4 py-6 space-y-4" style={{ color: 'var(--g-text)' }}>
      {offer.active && offer.expiresAt && (
        <div className="rounded-2xl border p-4" style={box}>
          <p className="font-bold">{t('plus.stActive')}</p>
          <p className="text-sm" style={{ color: 'var(--g-text-2)' }}>{t('plus.until')} {fmtDate(offer.expiresAt)} · {Math.max(0, Math.ceil((Date.parse(offer.expiresAt) - Date.now()) / 86_400_000))} {t('plus.stLeft')}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--g-text-3)' }}>{offer.playActive ? t('plus.stPlay') : t('plus.stSource')}</p>
        </div>
      )}

      {offer.playActive ? null : !offer.enabled ? (
        <p className="rounded-2xl border p-4 text-sm" style={box}>{t('err.plusUnavailable')}</p>
      ) : step === 'offer' ? (
        <>
          <h1 className="text-2xl font-extrabold">{offer.active ? t('plus.extTitle') : plusHeadline(plusCap, locale)}</h1>
          {lookupsCopy && <p className="text-sm" data-testid="plus-lead">{tf('plus.lead')}</p>}
          <p className="text-sm" style={{ color: 'var(--g-text-2)' }}>{t('plus.sub')}</p>
          <ul className="space-y-1.5 text-sm">
            {/* 10 / 10b (+imports) / 10c (+quizzes, only with imports) enforced in plusBullets; numbers from config. */}
            {plusBullets(nums.pct, nums.plusQ > 0 && nums.freeQ > 0).filter((k) => k !== 'plus.b1' || lookupsCopy).map((k) => <li key={k} className="flex gap-2" data-testid={`bullet-${k}`}><Check className="w-4 h-4 mt-0.5" style={{ color: 'var(--g-ok)' }} aria-hidden />{tf(k)}</li>)}
          </ul>
          <div role="radiogroup" className="grid grid-cols-2 gap-2">
            {offer.plans.map((p) => (
              <button key={p.days} type="button" role="radio" aria-checked={days === p.days} onClick={() => setDays(p.days)}
                className="rounded-2xl border-2 p-3 text-left min-h-[44px]" style={{ ...box, borderColor: days === p.days ? 'var(--g-accent)' : 'var(--g-line)' }}>
                <div className="text-sm font-semibold">{p.days === 365 ? t('plus.o365') : t('plus.o30')}</div>
                <PriceTag amountUzs={p.priceUzs} />
                {p.days === 365 && p30 && <div className="text-xs" style={{ color: 'var(--g-text-2)' }}>≈ {som(Math.round(p.priceUzs / 12))} · {savePct != null && savePct > 0 ? `−${savePct}%` : ''}</div>}
              </button>
            ))}
          </div>
          {offer.active && (
            <p className="text-sm" style={{ color: 'var(--g-text-2)' }}>{t('plus.extNew')}: <b>{fmtDate(extendedEnd(offer.expiresAt, days))}</b>. {t('plus.extNote')}</p>
          )}
          {error && <p role="alert" className="text-sm" style={{ color: 'var(--g-bad)' }}>{error}</p>}
          <label className="flex items-start gap-2 text-sm" data-testid="oferta-consent">
            <input type="checkbox" required checked={ofertaOk} onChange={(e) => setOfertaOk(e.target.checked)} className="mt-1 h-4 w-4 shrink-0" data-testid="oferta-checkbox" aria-describedby={gate.needsOferta ? 'oferta-hint' : undefined} />
            <span>{oc.parts.map((p, i) => p.href
              ? <a key={i} href={plusLegalHref(MARKETING_URL, p.href, locale)} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'var(--g-accent)' }} data-testid={p.href === '/oferta' ? 'oferta-link' : `legal-link-${p.href.slice(1)}`}>{p.text}</a>
              : <span key={i}>{p.text}</span>)}</span>
          </label>
          {gate.needsOferta && <p id="oferta-hint" className="text-xs" style={{ color: 'var(--g-text-2)' }} data-testid="oferta-hint">{oc.hint}</p>}
          <button type="button" disabled={gate.disabled} onClick={start} data-testid="plus-pay" className="w-full min-h-[48px] rounded-[14px] font-bold text-[var(--g-on-cta)] disabled:opacity-50" style={{ background: 'var(--g-cta)' }}>
            {loading ? <Loader2 className="inline w-4 h-4 animate-spin" /> : null} {plan ? `${t('pay.amount')} ${som(plan.priceUzs)}` : t('plus.cta')}
          </button>
          <p className="text-[12px]" style={{ color: 'var(--g-text-3)' }}>{t('plus.noRenew')} {plusSmallPrint(t('plus.small'), nums.pct)}</p>
        </>
      ) : (
        <div className="rounded-2xl border p-4 space-y-3" style={box}>
          <p className="text-sm font-semibold">{days === 365 ? t('plus.item365') : t('plus.item30')} · {plan && som(plan.priceUzs)}</p>
          {step === 'card' && <CardForm pan={pan} exp={exp} onPan={setPan} onExp={setExp} onSubmit={submitCard} amountUzs={plan?.priceUzs ?? 0} loading={loading} error={error} onCancel={() => setConfirmCancel(true)} />}
          {step === 'otp' && <OtpForm cardMask={pan} otp={otp} onOtp={setOtp} onSubmit={submitOtp} onResend={() => void guard(async () => { await retryOtp(paymentId!); })} loading={loading} error={error} onCancel={() => setConfirmCancel(true)} />}
        </div>
      )}
      <PayTrust plus />
      <CancelConfirm open={confirmCancel} busy={loading} onKeep={() => setConfirmCancel(false)} onConfirm={() => void guard(async () => {
        setConfirmCancel(false);
        if (paymentId) {
          const r = await runCancel(() => cancelPayment(paymentId, 'learner_cancel'));
          if (cancelScreen(r) !== '06') { setCancelOutcome(r); return; }
        }
        setPaymentId(null); setStep('offer'); setOtp('');
      })} />
      {cancelOutcome && <CancelOutcome outcome={cancelOutcome} reference={paymentId} needsAttention={cancelOutcome.needsAttention} onDone={() => { setCancelOutcome(null); setPaymentId(null); setStep('offer'); setOtp(''); }} />}
    </div>
  );
}
