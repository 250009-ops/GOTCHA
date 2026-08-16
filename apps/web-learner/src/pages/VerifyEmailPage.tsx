import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { AuthShell } from '../components/AuthShell';
import { api, clearTokens } from '../lib/api';
import { openEmailInbox } from '../lib/emailInbox';
import { VerifyIcon, verifyAssets as a } from '../assets/verify';

type Phase = 'sent' | 'verifying' | 'success' | 'error';

function EnvelopeIllustration() {
  return (
    <div className="relative flex items-center justify-center size-[180px]">
      <img
        src={a.bgGlow}
        alt=""
        className="absolute left-1/2 top-1/2 size-[150px] -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        width={150}
        height={150}
      />
      <div className="absolute left-0 top-6 rounded-[10px] bg-[#2107aa] px-3 py-1.5 text-sm font-extrabold text-white shadow-[0_4px_4px_rgba(33,7,170,0.2)]">
        A
      </div>
      <div className="absolute right-0 top-4 rounded-[10px] bg-[#6c1d95] px-3 py-1.5 text-sm font-extrabold text-white shadow-[0_4px_4px_rgba(108,29,149,0.2)]">
        あ
      </div>
      <img
        src={a.envelope}
        alt=""
        className="relative z-[1] h-[80px] w-[100px] object-contain"
        width={100}
        height={80}
      />
      <img
        src={a.badgeCheck}
        alt=""
        className="absolute right-[22px] bottom-[36px] z-[2] size-[30px]"
        width={30}
        height={30}
      />
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

  useEffect(() => {
    // Auth routes should not keep a stale learner session (avoids /users/me 401 spam).
    clearTokens();
  }, []);

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
    const opened = openEmailInbox(email);
    if (!opened) {
      toast.message(`Open the inbox for ${email || 'your email'} and tap the verification link.`);
    }
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
    <AuthShell>
      <div className="w-full max-w-[500px] min-w-0">
        <div className="bg-white border border-[#e5e7eb] rounded-2xl xl:rounded-[24px] p-5 sm:p-8 xl:p-12 flex flex-col items-center gap-7 shadow-[0_18px_20px_rgba(0,0,0,0.08),0_2px_4px_rgba(0,0,0,0.06)]">
          <div className="flex flex-col gap-2 text-center w-full">
            <h1 className="text-2xl xl:text-[32px] font-extrabold text-[#101828] leading-8 xl:leading-10">
              {title}
            </h1>
            <p className="text-[15px] leading-[22px] text-[#6b7280]">{body}</p>
          </div>

          {phase !== 'verifying' && <EnvelopeIllustration />}

          {email && phase !== 'verifying' && (
            <div className="flex w-full items-center gap-2.5 rounded-[20px] border border-[#e5e7eb] bg-[#f3f4f6] px-6 py-3">
              <VerifyIcon src={a.user} size={18} />
              <span className="text-[15px] font-bold text-[#101828] truncate">{email}</span>
            </div>
          )}

          {phase === 'sent' && (
            <div className="flex flex-col gap-5 w-full items-center">
              <Button
                type="button"
                onClick={openEmailApp}
                className="w-full h-14 rounded-[14px] bg-[#6c1d95] hover:bg-[#5a187d] font-bold text-base shadow-[0_10px_12px_rgba(108,29,149,0.2)] gap-2.5"
              >
                <VerifyIcon src={a.externalLink} size={20} />
                Open Email App
              </Button>
              <p className="text-sm font-semibold text-[#6b7280]">
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

          {phase === 'verifying' && (
            <div className="flex items-center gap-2 text-sm text-[#6b7280]">
              <span className="w-4 h-4 border-2 border-[#6c1d95]/30 border-t-[#6c1d95] rounded-full animate-spin" />
              Confirming your email…
            </div>
          )}

          <div className="h-px w-full bg-[#e5e7eb]" />

          <div className="flex items-center justify-center gap-1.5 text-sm">
            <span className="font-medium text-[#6b7280]">Already verified?</span>
            <Link to="/login" className="font-bold text-[#6c1d95] underline underline-offset-2">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </AuthShell>
  );
}
