import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { api } from '../lib/api';
import { VerifyIcon, verifyAssets as a } from '../assets/verify';

type Phase = 'sent' | 'verifying' | 'success' | 'error';

function BrandMark() {
  return (
    <div className="flex items-center gap-3">
      <div
        className="flex items-center justify-center bg-[#2107aa] rounded-[12px]"
        style={{ width: 40, height: 40 }}
      >
        <span
          className="text-white text-2xl leading-none"
          style={{ fontFamily: 'Bagel Fat One, cursive' }}
        >
          G
        </span>
      </div>
      <span
        className="text-[20px] leading-7 tracking-[-0.5px] text-[#101828]"
        style={{ fontFamily: 'Bagel Fat One, cursive' }}
      >
        GOTCHA
      </span>
    </div>
  );
}

function EnvelopeIllustration() {
  return (
    <div className="relative flex items-center justify-center size-[140px]">
      <img
        src={a.bgGlow}
        alt=""
        className="absolute left-1/2 top-1/2 size-[120px] -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        width={120}
        height={120}
      />
      <div className="absolute left-0 top-5 rounded-lg bg-[#6c1d95] px-2 py-1 text-xs font-bold text-white shadow-[0_4px_4px_rgba(108,29,149,0.2)]">
        A
      </div>
      <div className="absolute left-[100px] top-3.5 rounded-lg bg-[#2107aa] px-2 py-1 text-xs font-bold text-white shadow-[0_4px_4px_rgba(33,7,170,0.2)]">
        あ
      </div>
      <div className="relative flex h-16 w-20 flex-col items-center justify-center rounded-xl border-[3px] border-[#6c1d95] bg-white p-2.5 shadow-[0_8px_8px_rgba(0,0,0,0.06)]">
        <VerifyIcon src={a.mailOpen} size={24} />
      </div>
      <div className="absolute left-[90px] top-[84px] flex size-6 items-center justify-center rounded-xl border-2 border-white bg-[#10b981]">
        <VerifyIcon src={a.check} size={12} />
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token')?.trim() || '';
  const emailParam = searchParams.get('email')?.trim() || '';

  const initialPhase: Phase = token ? 'verifying' : 'sent';
  const [phase, setPhase] = useState<Phase>(initialPhase);
  const [email, setEmail] = useState(emailParam);
  const [error, setError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  const title = useMemo(() => {
    if (phase === 'success') return 'Email verified';
    if (phase === 'error') return 'Link expired';
    if (phase === 'verifying') return 'Verifying…';
    return 'Verify your email';
  }, [phase]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api<{ verified: boolean; email?: string }>(
          `/auth/verify-email?token=${encodeURIComponent(token)}`,
        );
        if (cancelled) return;
        if (res.email) setEmail(res.email);
        setPhase('success');
        toast.success('Email verified — you can sign in now');
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Invalid or expired verification link');
        setPhase('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const openEmailApp = () => {
    // Best-effort: open the user's default mail client / webmail tab.
    window.location.href = 'mailto:';
  };

  const resend = async () => {
    if (!email) {
      toast.error('Enter the email you registered with');
      return;
    }
    setResending(true);
    try {
      await api('/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      toast.success('Verification email sent — check your inbox');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not resend email');
    } finally {
      setResending(false);
    }
  };

  const body =
    phase === 'success'
      ? 'Your email is confirmed. Sign in to start your reading journey.'
      : phase === 'error'
        ? error || 'This verification link is invalid or has expired. Request a new one below.'
        : phase === 'verifying'
          ? 'Hang tight while we confirm your email address…'
          : "We've sent a verification link to your email address. Please check your inbox and tap the link to confirm your account.";

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <div className="flex items-center justify-between px-5 sm:px-8 pt-6 pb-2">
        <button
          type="button"
          onClick={() => navigate(email ? `/register` : '/login')}
          className="flex size-10 items-center justify-center rounded-xl hover:bg-gray-50"
          aria-label="Back"
        >
          <VerifyIcon src={a.chevronLeft} size={20} />
        </button>
        <BrandMark />
        <div className="size-10" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-7 py-8 max-w-[448px] w-full mx-auto gap-7">
        <EnvelopeIllustration />

        <div className="flex flex-col gap-3 text-center w-full">
          <h1 className="text-2xl font-extrabold text-[#111827] leading-tight">{title}</h1>
          <p className="text-[15px] leading-relaxed text-[#4b5563]">{body}</p>
        </div>

        {email && phase !== 'verifying' && (
          <div className="inline-flex items-center gap-2 rounded-[20px] border border-[#e9d5ff] bg-[#f3e8ff] px-5 py-2.5">
            <VerifyIcon src={a.user} size={16} />
            <span className="text-[15px] font-semibold text-[#6c1d95]">{email}</span>
          </div>
        )}

        {phase === 'sent' && (
          <div className="flex flex-col gap-5 w-full items-center">
            <Button
              type="button"
              onClick={openEmailApp}
              className="w-full h-14 rounded-[14px] bg-[#6c1d95] hover:bg-[#5a187d] font-bold text-base shadow-[0_8px_8px_rgba(108,29,149,0.14)] gap-2"
            >
              <VerifyIcon src={a.externalLink} size={20} />
              Open Email App
            </Button>
            <p className="text-sm font-semibold text-[#4b5563]">
              Didn&apos;t receive it?{' '}
              <button
                type="button"
                onClick={() => void resend()}
                disabled={resending}
                className="text-[#6c1d95] underline underline-offset-2 disabled:opacity-60"
              >
                {resending ? 'Sending…' : 'Resend email'}
              </button>
            </p>
          </div>
        )}

        {phase === 'error' && (
          <div className="flex flex-col gap-4 w-full items-center">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full h-11 px-3.5 bg-[#f9fafb] border border-[#e5e7eb] rounded-[14px] text-sm text-[#101828] outline-none focus:ring-2 focus:ring-[#6c1d95]/20 focus:border-[#6c1d95]"
            />
            <Button
              type="button"
              onClick={() => void resend()}
              disabled={resending || !email}
              className="w-full h-14 rounded-[14px] bg-[#6c1d95] hover:bg-[#5a187d] font-bold text-base"
            >
              {resending ? 'Sending…' : 'Resend verification email'}
            </Button>
          </div>
        )}

        {phase === 'success' && (
          <Button
            type="button"
            onClick={() => navigate('/login')}
            className="w-full h-14 rounded-[14px] bg-[#6c1d95] hover:bg-[#5a187d] font-bold text-base"
          >
            Sign in
          </Button>
        )}
      </div>

      <div className="flex items-center justify-center gap-1.5 pb-9 pt-6 text-sm">
        <span className="font-medium text-[#4b5563]">Already verified?</span>
        <Link to="/login" className="font-bold text-[#6c1d95] underline underline-offset-2">
          Sign in
        </Link>
      </div>
    </div>
  );
}
