import { useEffect, useMemo, useState } from 'react';
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
      <div className="absolute right-0 top-4 rounded-[10px] bg-g-blue-700 px-3 py-1.5 text-sm font-extrabold text-white shadow-[0_4px_4px_rgba(33, 7, 170,0.2)]">
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

  useEffect(() => {
    if (!token || androidHandoff) return;
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
        <div className="w-full max-w-[500px] min-w-0">
          <div className="bg-white border border-[#e5e7eb] rounded-2xl p-8 flex flex-col items-center gap-5 shadow-[0_18px_20px_rgba(0,0,0,0.08),0_2px_4px_rgba(0,0,0,0.06)] text-center">
            <h1 className="text-2xl font-extrabold text-[#101828] leading-8">{copy.authPages.openAppTitle}</h1>
            <p className="text-[15px] leading-[22px] text-[#6b7280]">{copy.authPages.openAppBody}</p>
            <Button
              type="button"
              onClick={() => tryOpenGotchaAuthApp('verify-email', token, searchParams)}
              className="w-full h-14 rounded-[14px] bg-g-blue-700 hover:bg-[#5a187d] font-bold text-base shadow-[0_10px_12px_rgba(33, 7, 170,0.2)]"
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
                className="w-full h-14 rounded-[14px] bg-g-blue-700 hover:bg-[#5a187d] font-bold text-base shadow-[0_10px_12px_rgba(33, 7, 170,0.2)] gap-2.5"
              >
                <VerifyIcon src={a.externalLink} size={20} />
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
                className="w-full h-11 px-3.5 bg-[#f9fafb] border border-[#e5e7eb] rounded-[14px] text-sm text-[#101828] outline-none focus:ring-2 focus:ring-g-blue-700/20 focus:border-g-blue-700"
              />
              <Button
                type="button"
                onClick={() => void resend()}
                disabled={resending || !email}
                className="w-full h-14 rounded-[14px] bg-g-blue-700 hover:bg-[#5a187d] font-bold text-base"
              >
                {resending ? copy.authPages.sending : copy.authPages.resendVerification}
              </Button>
            </div>
          )}

          {phase === 'success' && (
            <Button
              type="button"
              onClick={() => navigate(loginPath)}
              className="w-full h-14 rounded-[14px] bg-g-blue-700 hover:bg-[#5a187d] font-bold text-base"
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

          <div className="h-px w-full bg-[#e5e7eb]" />

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
