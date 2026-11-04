import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { AuthShell, notifyLearnerCountChanged } from '../components/AuthShell';
import { api, clearTokens } from '../lib/api';
import { openEmailInbox } from '../lib/emailInbox';
import { loginPathWithReturn } from '../lib/authRoutes';
import { isAndroidDevice, tryOpenGotchaAuthApp } from '../lib/mobileAppAuth';
import { isAllowedAdminReturnUrl } from '../lib/links';
import { useLearnerCopy } from '../lib/learnerLocaleContext';
import { CircleCheck, ExternalLink, Mail, MailWarning, UserRound } from 'lucide-react';

type Phase = 'sent' | 'verifying' | 'success' | 'error';

/** Status badge — replaces the old image-based envelope illustration (lighter, theme-consistent). */
function PhaseBadge({ phase }: { phase: Phase }) {
  const ok = phase === 'success';
  const bad = phase === 'error';
  const Icon = ok ? CircleCheck : bad ? MailWarning : Mail;
  return (
    <div className="relative grid place-items-center size-[88px]">
      <span className={`absolute inset-0 rounded-[26px] ${ok ? 'bg-emerald-50' : bad ? 'bg-[#fff1f1]' : 'bg-[#f1efff]'}`} />
      <span className={`absolute inset-3 rounded-[20px] ${ok ? 'bg-emerald-100' : bad ? 'bg-[#ffe1e1]' : 'bg-[#e4e0ff]'}`} />
      <Icon className={`relative w-9 h-9 ${ok ? 'text-emerald-600' : bad ? 'text-[#dc2626]' : 'text-g-blue-700'}`} strokeWidth={1.8} />
    </div>
  );
}

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const copy = useLearnerCopy();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token')?.trim() || '';
  const emailParam = searchParams.get('email')?.trim() || '';
  const adminReturnUrl = isAllowedAdminReturnUrl(searchParams.get('returnUrl'));
  const loginPath = loginPathWithReturn(searchParams);

  const initialPhase: Phase = token ? 'verifying' : 'sent';
  const [phase, setPhase] = useState<Phase>(initialPhase);
  const [email, setEmail] = useState(emailParam);
  const [error, setError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [useWebFlow, setUseWebFlow] = useState(false);
  const androidHandoff = isAndroidDevice() && !!token && !useWebFlow;

  useEffect(() => {
    clearTokens();
  }, []);

  const title = useMemo(() => {
    if (phase === 'success') return copy.authPages.verifySuccessTitle;
    if (phase === 'error') return copy.authPages.verifyErrorTitle;
    if (phase === 'verifying') return copy.authPages.verifyingTitle;
    return copy.authPages.verifyTitle;
  }, [phase, copy.authPages]);

  useEffect(() => {
    if (!token || useWebFlow || !isAndroidDevice()) return;
    tryOpenGotchaAuthApp('verify-email', token, searchParams);
  }, [token, useWebFlow, searchParams]);

  // BUG-12: verify tokens are single-use; StrictMode / dep changes must not fire the request twice.
  const verifiedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!token || androidHandoff) return;
    if (verifiedFor.current === token) return;
    verifiedFor.current = token;
    let cancelled = false;
    (async () => {
      try {
        const res = await api<{ verified: boolean; email?: string }>(
          `/auth/verify-email?token=${encodeURIComponent(token)}`,
        );
        if (cancelled) return;
        if (res.email) setEmail(res.email);
        setPhase('success');
        notifyLearnerCountChanged();
        toast.success(copy.authPages.verifiedToast);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : copy.authPages.verifyErrorBody);
        setPhase('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, androidHandoff, copy.authPages]);

  const openEmailApp = () => {
    const opened = openEmailInbox(email);
    if (!opened) {
      toast.message(copy.authPages.openInboxHint(email));
    }
  };

  const resend = async () => {
    if (!email) {
      toast.error(copy.authPages.enterRegisteredEmail);
      return;
    }
    setResending(true);
    try {
      await api('/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email, clientPlatform: 'web' }),
      });
      toast.success(copy.authPages.verificationSent);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.authPages.couldNotResend);
    } finally {
      setResending(false);
    }
  };

  const body =
    phase === 'success'
      ? adminReturnUrl
        ? copy.authPages.verifySuccessAdminBody
        : copy.authPages.verifySuccessBody
      : phase === 'error'
        ? error || copy.authPages.verifyErrorBody
        : phase === 'verifying'
          ? copy.authPages.verifyingBody
          : adminReturnUrl
            ? copy.authPages.verifySentAdminBody
            : copy.authPages.verifySentBody;

  if (androidHandoff) {
    return (
      <AuthShell>
        <div className="w-full max-w-[448px] min-w-0">
          <div className="bg-white border border-[#e6e8f0] rounded-[20px] p-5 sm:p-8 flex flex-col items-center gap-6 shadow-[0_24px_48px_-24px_rgba(16,24,40,0.18)] text-center">
            <h1 className="text-[26px] font-extrabold tracking-tight text-[#101828] leading-8">{copy.authPages.openAppTitle}</h1>
            <p className="text-[15px] leading-[22px] text-[#6b7280]">{copy.authPages.openAppBody}</p>
            <Button
              type="button"
              onClick={() => tryOpenGotchaAuthApp('verify-email', token, searchParams)}
              className="w-full h-12 rounded-xl bg-g-blue-700 hover:bg-g-blue-800 font-bold text-[15px] shadow-[0_10px_20px_-8px_rgba(33,7,170,0.45)]"
            >
              {copy.authPages.openGotchaApp}
            </Button>
            <button
              type="button"
              onClick={() => setUseWebFlow(true)}
              className="text-sm font-semibold text-g-blue-700 hover:text-g-blue-800"
            >
              {copy.authPages.continueOnWeb}
            </button>
          </div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="w-full max-w-[448px] min-w-0">
        <div className="bg-white border border-[#e6e8f0] rounded-[20px] p-5 sm:p-8 flex flex-col items-center gap-6 shadow-[0_24px_48px_-24px_rgba(16,24,40,0.18)]">
          <div className="flex flex-col gap-2 text-center w-full">
            <h1 className="text-[26px] font-extrabold tracking-tight text-[#101828] leading-8">
              {title}
            </h1>
            <p className="text-[15px] leading-[22px] text-[#6b7280]">{body}</p>
          </div>

          {phase !== 'verifying' && <PhaseBadge phase={phase} />}

          {email && phase !== 'verifying' && (
            <div className="flex w-full items-center gap-2.5 rounded-xl border border-[#e6e8f0] bg-[#f6f7fb] px-4 py-3">
              <UserRound className="w-[18px] h-[18px] text-[#8a8fa0] shrink-0" />
              <span className="text-[15px] font-semibold text-[#101828] truncate">{email}</span>
            </div>
          )}

          {phase === 'sent' && (
            <div className="flex flex-col gap-5 w-full items-center">
              <Button
                type="button"
                onClick={openEmailApp}
                className="w-full h-12 rounded-xl bg-g-blue-700 hover:bg-g-blue-800 font-bold text-[15px] shadow-[0_10px_20px_-8px_rgba(33,7,170,0.45)] gap-2.5"
              >
                <ExternalLink className="w-[18px] h-[18px]" />
                {copy.authPages.openEmailApp}
              </Button>
              <p className="text-sm font-semibold text-[#6b7280]">
                {copy.authPages.didntReceive}{' '}
                <button
                  type="button"
                  onClick={() => void resend()}
                  disabled={resending}
                  className="text-g-blue-700 underline underline-offset-2 disabled:opacity-60"
                >
                  {resending ? copy.authPages.sending : copy.authPages.resendEmail}
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
                className="w-full h-12 px-3.5 bg-white border border-[#dfe2ec] rounded-xl text-[15px] text-[#101828] placeholder:text-[#9aa0ae] outline-none focus:ring-4 focus:ring-g-blue-700/10 focus:border-g-blue-700"
              />
              <Button
                type="button"
                onClick={() => void resend()}
                disabled={resending || !email}
                className="w-full h-12 rounded-xl bg-g-blue-700 hover:bg-g-blue-800 font-bold text-[15px] shadow-[0_10px_20px_-8px_rgba(33,7,170,0.45)]"
              >
                {resending ? copy.authPages.sending : copy.authPages.resendVerification}
              </Button>
            </div>
          )}

          {phase === 'success' && (
            <Button
              type="button"
              onClick={() => navigate(loginPath)}
              className="w-full h-12 rounded-xl bg-g-blue-700 hover:bg-g-blue-800 font-bold text-[15px] shadow-[0_10px_20px_-8px_rgba(33,7,170,0.45)]"
            >
              {copy.auth.signIn}
            </Button>
          )}

          {phase === 'verifying' && (
            <div className="flex items-center gap-2 text-sm text-[#6b7280]">
              <span className="w-4 h-4 border-2 border-g-blue-700/30 border-t-g-blue-700 rounded-full animate-spin" />
              {copy.authPages.confirmEmail}
            </div>
          )}

          <div className="h-px w-full bg-[#eef0f5]" />

          <div className="flex items-center justify-center gap-1.5 text-sm">
            <span className="font-medium text-[#6b7280]">{copy.authPages.alreadyVerified}</span>
            <Link to={loginPath} className="font-bold text-g-blue-700 underline underline-offset-2">
              {copy.auth.signIn}
            </Link>
          </div>
        </div>
      </div>
    </AuthShell>
  );
}
