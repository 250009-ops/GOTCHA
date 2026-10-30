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
        <div className="bg-white border border-[#e5e7eb] rounded-2xl p-8 flex flex-col gap-5 shadow-[0_18px_20px_rgba(0,0,0,0.08),0_2px_4px_rgba(0,0,0,0.06)]">
          {!sent ? (
            <>
              <div className="flex flex-col gap-1.5">
                <h2 className="text-2xl font-extrabold text-[#101828] leading-8">{copy.authPages.forgotTitle}</h2>
                <p className="text-[#6b7280] text-sm leading-5">
                  {adminReturnUrl ? copy.authPages.forgotAdminSubtitle : copy.authPages.forgotSubtitle}
                </p>
              </div>

              <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-[#4a5565]">{copy.auth.email}</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="w-full h-11 px-3.5 bg-[#f9fafb] border border-[#e5e7eb] rounded-[14px] text-sm text-[#101828] placeholder:text-[#9ca3af] outline-none focus:ring-2 focus:ring-g-blue-700/20 focus:border-g-blue-700 focus:bg-white transition-all"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 rounded-[14px] bg-g-blue-700 hover:bg-g-blue-800 font-bold text-sm shadow-[0_10px_12px_rgba(33, 7, 170,0.2)]"
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
                <h2 className="text-2xl font-extrabold text-[#101828] leading-8">{copy.authPages.checkEmail}</h2>
                <p className="text-[#6b7280] text-sm leading-5">{copy.authPages.checkEmailBody}</p>
              </div>

              <div className="flex justify-center py-2">
                <div className="flex items-center justify-center size-16 rounded-2xl bg-[#f3f0ff] text-g-blue-700">
                  <Mail className="w-8 h-8" />
                </div>
              </div>

              {email && (
                <div className="flex w-full items-center gap-2.5 rounded-[14px] border border-[#e5e7eb] bg-[#f3f4f6] px-4 py-3">
                  <span className="text-sm font-bold text-[#101828] truncate">{email}</span>
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
                className="w-full h-11 rounded-[14px] bg-g-blue-700 hover:bg-g-blue-800 font-bold text-sm shadow-[0_10px_12px_rgba(33, 7, 170,0.2)]"
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
