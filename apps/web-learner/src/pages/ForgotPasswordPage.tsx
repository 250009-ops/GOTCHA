import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { AuthShell } from '../components/AuthShell';
import { api, clearTokens } from '../lib/api';
import { openEmailInbox } from '../lib/emailInbox';
import { MARKETING_URL, isAllowedAdminReturnUrl } from '../lib/links';
import { authFlowSearch, loginPathWithReturn } from '../lib/authRoutes';
import { useLearnerCopy } from '../lib/learnerLocaleContext';

/** Figma 187:8 — Reset password request (email → send link). */
export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const copy = useLearnerCopy();
  const [searchParams] = useSearchParams();
  const adminReturnUrl = isAllowedAdminReturnUrl(searchParams.get('returnUrl'));
  const loginPath = loginPathWithReturn(searchParams);
  const forgotQuery = authFlowSearch(searchParams);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    clearTokens();
  }, []);

  const goHome = () => {
    window.location.assign(MARKETING_URL);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error(copy.authPages.enterEmail);
      return;
    }
    setLoading(true);
    try {
      await api('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), clientPlatform: 'web' }),
      });
      setSent(true);
      toast.success(copy.authPages.resetLinkSent);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.authPages.couldNotSendReset);
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (!email.trim()) return;
    setLoading(true);
    try {
      await api('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), clientPlatform: 'web' }),
      });
      toast.success(copy.authPages.resetLinkResent);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.authPages.couldNotResend);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <div className="w-full max-w-[448px] min-w-0">
        <div className="bg-white border border-[#e6e8f0] rounded-[20px] p-5 sm:p-8 flex flex-col gap-6 shadow-[0_24px_48px_-24px_rgba(16,24,40,0.18)]">
          {!sent ? (
            <>
              <div className="flex flex-col gap-1.5">
                <h2 className="text-[26px] font-extrabold tracking-tight text-[#101828] leading-8">{copy.authPages.forgotTitle}</h2>
                <p className="text-[#6b7280] text-sm leading-5">
                  {adminReturnUrl ? copy.authPages.forgotAdminSubtitle : copy.authPages.forgotSubtitle}
                </p>
              </div>

              <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-[#4a5565]">{copy.auth.email}</label>
                  <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#9aa0ae]" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="w-full h-12 pl-11 pr-3.5 bg-white border border-[#dfe2ec] rounded-xl text-[15px] text-[#101828] placeholder:text-[#9aa0ae] hover:border-[#c5cafd] outline-none focus:border-g-blue-700 focus:ring-4 focus:ring-g-blue-700/10 transition-all"
                  />
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 rounded-xl bg-g-blue-700 hover:bg-g-blue-800 font-bold text-[15px] shadow-[0_10px_20px_-8px_rgba(33,7,170,0.45)]"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {copy.authPages.sending}
                    </span>
                  ) : (
                    copy.authPages.sendResetLink
                  )}
                </Button>
              </form>

              <div className="flex items-center justify-between text-[13px] whitespace-nowrap">
                <span className="text-[#6b7280]">{copy.auth.hasAccount}</span>
                <Link to={loginPath} className="text-g-blue-700 font-bold hover:text-g-blue-800">
                  {copy.auth.signIn}
                </Link>
              </div>

              <button
                type="button"
                onClick={goHome}
                className="flex items-center justify-center gap-2 text-[13px] text-[#9ca3af] hover:text-[#4a5565] w-full"
              >
                <ArrowLeft className="w-4 h-4" />
                {copy.auth.backToHomepage}
              </button>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1.5 text-center">
                <h2 className="text-[26px] font-extrabold tracking-tight text-[#101828] leading-8">{copy.authPages.checkEmail}</h2>
                <p className="text-[#6b7280] text-sm leading-5">{copy.authPages.checkEmailBody}</p>
              </div>

              <div className="flex justify-center py-2">
                <div className="flex items-center justify-center size-[72px] rounded-[22px] bg-[#f1efff] text-g-blue-700">
                  <Mail className="w-9 h-9" strokeWidth={1.8} />
                </div>
              </div>

              {email && (
                <div className="flex w-full items-center gap-2.5 rounded-xl border border-[#e6e8f0] bg-[#f6f7fb] px-4 py-3">
                  <span className="text-[15px] font-semibold text-[#101828] truncate">{email}</span>
                </div>
              )}

              <Button
                type="button"
                onClick={() => {
                  const opened = openEmailInbox(email);
                  if (!opened) {
                    toast.message(copy.authPages.openInboxHint(email));
                  }
                }}
                className="w-full h-12 rounded-xl bg-g-blue-700 hover:bg-g-blue-800 font-bold text-[15px] shadow-[0_10px_20px_-8px_rgba(33,7,170,0.45)]"
              >
                {copy.authPages.openEmailApp}
              </Button>

              <p className="text-sm text-center text-[#6b7280]">
                {copy.authPages.didntReceive}{' '}
                <button
                  type="button"
                  onClick={() => void resend()}
                  disabled={loading}
                  className="text-g-blue-700 font-semibold underline underline-offset-2 disabled:opacity-60"
                >
                  {loading ? copy.authPages.sending : copy.authPages.resendEmail}
                </button>
              </p>

              <div className="flex items-center justify-between text-[13px] whitespace-nowrap">
                <span className="text-[#6b7280]">{copy.auth.hasAccount}</span>
                <Link to={loginPath} className="text-g-blue-700 font-bold hover:text-g-blue-800">
                  {copy.auth.signIn}
                </Link>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSent(false);
                  navigate(forgotQuery ? `/forgot-password?${forgotQuery}` : '/forgot-password');
                }}
                className="flex items-center justify-center gap-2 text-[13px] text-[#9ca3af] hover:text-[#4a5565] w-full"
              >
                <ArrowLeft className="w-4 h-4" />
                {copy.authPages.useDifferentEmail}
              </button>
            </>
          )}
        </div>
      </div>
    </AuthShell>
  );
}
