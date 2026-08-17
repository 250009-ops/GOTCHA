import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Loader2, Lock, PartyPopper } from 'lucide-react';
import {
  applyPayment,
  checkoutCatalog,
  formatUzs,
  preApplyPayment,
  retryOtp,
} from '../lib/importBilling';

type PayStep = 'price' | 'card' | 'otp' | 'celebrate';

const CONFETTI_COLORS = ['#7008e7', '#f59e0b', '#22c55e', '#ef4444', '#3b82f6', '#ec4899', '#facc15'];

function ConfettiBurst() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 56 }, (_, i) => ({
        id: i,
        left: `${(i * 17) % 100}%`,
        delay: `${(i % 12) * 0.08}s`,
        duration: `${1.4 + (i % 5) * 0.18}s`,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        drift: `${(i % 2 === 0 ? 1 : -1) * (18 + (i % 7) * 8)}px`,
        width: 6 + (i % 4) * 2,
        height: 10 + (i % 3) * 3,
      })),
    [],
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {pieces.map((p) => (
        <span
          key={p.id}
          className="gotcha-confetti-piece"
          style={{
            left: p.left,
            animationDelay: p.delay,
            animationDuration: p.duration,
            background: p.color,
            width: p.width,
            height: p.height,
            ['--drift' as string]: p.drift,
          }}
        />
      ))}
    </div>
  );
}

export function CatalogPaywall({
  contentId,
  title,
  priceUzs,
  onUnlocked,
}: {
  contentId: string;
  title: string;
  priceUzs: number;
  onUnlocked: () => void;
}) {
  const [step, setStep] = useState<PayStep>('price');
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [otp, setOtp] = useState('');
  const [maskedPhone, setMaskedPhone] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [canResendOtp, setCanResendOtp] = useState(false);
  const unlockedRef = useRef(onUnlocked);
  unlockedRef.current = onUnlocked;

  useEffect(() => {
    if (step === 'otp') {
      setCanResendOtp(false);
      const timer = setTimeout(() => setCanResendOtp(true), 30000);
      return () => clearTimeout(timer);
    }
  }, [step]);

  useEffect(() => {
    if (step !== 'celebrate') return;
    const timer = setTimeout(() => unlockedRef.current(), 2200);
    return () => clearTimeout(timer);
  }, [step]);

  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 19);
    return digits.replace(/(.{4})/g, '$1 ').trim();
  };

  const formatExpiry = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 3) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return digits;
  };

  const cardDigits = cardNumber.replace(/\s/g, '');
  const isCardValid =
    cardDigits.length >= 16 &&
    cardDigits.length <= 19 &&
    (() => {
      const d = expiry.replace(/\D/g, '');
      return d.length === 4 && Number(d.slice(0, 2)) >= 1 && Number(d.slice(0, 2)) <= 12;
    })();
  const isOtpValid = otp.replace(/\s/g, '').length >= 4;

  const handleProceedToCard = async () => {
    setLoading(true);
    setError(null);
    try {
      const checkout = await checkoutCatalog(contentId);
      if (checkout.step === 'done' || checkout.accessGranted) {
        setStep('celebrate');
        return;
      }
      if (!checkout.paymentId) {
        throw new Error('Payment could not be started for this book.');
      }
      setPaymentId(checkout.paymentId);
      setStep('card');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start payment');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitCard = async () => {
    if (!paymentId || !isCardValid) return;
    setLoading(true);
    setError(null);
    try {
      const expiryFormatted = expiry.replace(/\//g, '');
      const result = await preApplyPayment(paymentId, cardNumber.replace(/\s/g, ''), expiryFormatted);
      if (result.step !== 'otp') {
        throw new Error('Unexpected payment state after card verification.');
      }
      setMaskedPhone(result.maskedPhone);
      setStep('otp');
      setOtp('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Card verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitOtp = async () => {
    if (!paymentId || !isOtpValid) return;
    setLoading(true);
    setError(null);
    try {
      const result = await applyPayment(paymentId, otp.replace(/\s/g, ''));
      if (result.step === 'paid') {
        setStep('celebrate');
      } else if (result.step === 'otp') {
        setError('Payment not confirmed yet. Check the SMS code and try again.');
        setOtp('');
      } else {
        setError('Payment not confirmed. Please try again with a different card.');
        setStep('card');
        setCardNumber('');
        setExpiry('');
        setOtp('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!paymentId) return;
    setLoading(true);
    setError(null);
    try {
      await retryOtp(paymentId);
      setCanResendOtp(false);
      setTimeout(() => setCanResendOtp(true), 30000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend OTP');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'celebrate') {
    return (
      <div className="relative w-full max-w-md mx-auto rounded-2xl bg-white border border-[#e5e7eb] shadow-xl min-h-[22rem] flex flex-col items-center justify-center gap-4 px-6 py-8 overflow-hidden">
        <ConfettiBurst />
        <div className="relative z-10 w-16 h-16 rounded-2xl bg-violet-50 grid place-items-center">
          <PartyPopper className="w-8 h-8 text-[#7008e7]" />
        </div>
        <div className="relative z-10 text-center space-y-1">
          <h2 className="text-[#101828] text-2xl font-bold">Congratulations!</h2>
          <p className="text-[#6a7282] text-sm">{title} is yours. Opening the book…</p>
        </div>
        <button
          type="button"
          onClick={onUnlocked}
          className="relative z-10 w-full h-[52px] rounded-[14px] bg-[#7008e7] hover:bg-[#5c06c0] text-white text-base font-bold flex items-center justify-center gap-2"
        >
          <BookOpen className="w-5 h-5" />
          Start reading
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto rounded-2xl bg-white border border-[#e5e7eb] shadow-xl flex flex-col items-center gap-5 px-6 py-7">
      {step === 'price' && (
        <>
          <div className="w-16 h-16 rounded-2xl bg-violet-50 grid place-items-center">
            <Lock className="w-7 h-7 text-[#7008e7]" />
          </div>
          <div className="text-center space-y-1">
            <h2 className="text-[#101828] text-xl font-bold leading-tight">{title}</h2>
            <p className="text-[#6a7282] text-sm">Pay once to unlock this book in your library.</p>
          </div>
          <div className="w-full border border-[#e4e7ec] rounded-xl p-4 bg-[#f9fafb]">
            <div className="flex justify-between items-center">
              <span className="text-[#101828] text-sm font-semibold">Total</span>
              <span className="text-[#7008e7] text-lg font-bold">{formatUzs(priceUzs)}</span>
            </div>
          </div>
        </>
      )}

      {step === 'card' && (
        <>
          <h2 className="text-[#101828] text-xl font-bold text-center">Enter Card Details</h2>
          <p className="text-[#6a7282] text-sm text-center -mt-3">UzCard, Humo, Visa, or Mastercard</p>
          <div className="w-full space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#4a5565] mb-1.5">Card Number</label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="cc-number"
                value={cardNumber}
                onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                placeholder="0000 0000 0000 0000"
                disabled={loading}
                className="w-full px-3 h-12 bg-white border border-[#e5e7eb] rounded-[14px] text-base outline-none focus:ring-2 focus:ring-violet-200 focus:border-[#7f22fe] font-mono tracking-wider disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#4a5565] mb-1.5">Expiry (MM/YY)</label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="cc-exp"
                value={expiry}
                onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                placeholder="00/00"
                disabled={loading}
                className="w-full px-3 h-12 bg-white border border-[#e5e7eb] rounded-[14px] text-base outline-none focus:ring-2 focus:ring-violet-200 focus:border-[#7f22fe] font-mono tracking-wider disabled:opacity-50"
              />
            </div>
          </div>
        </>
      )}

      {step === 'otp' && (
        <>
          <h2 className="text-[#101828] text-xl font-bold text-center">Enter SMS Code</h2>
          <p className="text-[#6a7282] text-sm text-center -mt-3">
            Code sent to {maskedPhone || 'your phone'}
          </p>
          <div className="w-full">
            <label className="block text-xs font-semibold text-[#4a5565] mb-1.5">OTP Code</label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              disabled={loading}
              className="w-full px-3 h-12 bg-white border border-[#e5e7eb] rounded-[14px] text-xl text-center outline-none focus:ring-2 focus:ring-violet-200 focus:border-[#7f22fe] font-mono tracking-[0.3em] disabled:opacity-50"
            />
          </div>
        </>
      )}

      {error && (
        <div className="w-full p-3 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}

      {step === 'price' && (
        <button
          type="button"
          onClick={handleProceedToCard}
          disabled={loading}
          className="w-full h-[52px] rounded-[14px] bg-[#7008e7] hover:bg-[#5c06c0] disabled:opacity-50 text-white text-base font-bold flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <BookOpen className="w-5 h-5" />}
          {loading ? 'Processing…' : `Unlock for ${formatUzs(priceUzs)}`}
        </button>
      )}

      {step === 'card' && (
        <button
          type="button"
          onClick={handleSubmitCard}
          disabled={loading || !isCardValid}
          className="w-full h-[52px] rounded-[14px] bg-[#7008e7] hover:bg-[#5c06c0] disabled:opacity-50 text-white text-base font-bold flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
          {loading ? 'Verifying…' : 'Continue'}
        </button>
      )}

      {step === 'otp' && (
        <button
          type="button"
          onClick={handleSubmitOtp}
          disabled={loading || !isOtpValid}
          className="w-full h-[52px] rounded-[14px] bg-[#7008e7] hover:bg-[#5c06c0] disabled:opacity-50 text-white text-base font-bold flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
          {loading ? 'Confirming…' : 'Confirm Payment'}
        </button>
      )}

      {step !== 'price' && (
        <button
          type="button"
          onClick={() => {
            setError(null);
            if (step === 'otp') {
              setStep('card');
              setOtp('');
            } else {
              setStep('price');
            }
          }}
          disabled={loading}
          className="text-[#6a7282] text-sm font-medium disabled:opacity-50"
        >
          Back
        </button>
      )}

      {step === 'otp' && canResendOtp && (
        <button
          type="button"
          onClick={handleResendOtp}
          disabled={loading}
          className="text-[#7008e7] text-sm font-medium disabled:opacity-50"
        >
          Resend Code
        </button>
      )}

      {step === 'card' && (
        <p className="text-[#6a7282] text-[11px] text-center leading-relaxed">
          Card details are sent directly to Atmos and are not stored.
        </p>
      )}
    </div>
  );
}
