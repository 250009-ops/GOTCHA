import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { AuthShell } from '../components/AuthShell';
import { api, clearTokens } from '../lib/api';
import { MARKETING_URL, isAllowedAdminReturnUrl } from '../lib/links';
import { loginPathWithReturn } from '../lib/authRoutes';
import { isAndroidDevice, tryOpenGotchaAuthApp } from '../lib/mobileAppAuth';
import { useLearnerCopy } from '../lib/learnerLocaleContext';

/** Set a new password from the emailed token (`?token=`). */
export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const copy = useLearnerCopy();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token')?.trim() || '';
  const adminReturnUrl = isAllowedAdminReturnUrl(searchParams.get('returnUrl'));
  const loginPath = loginPathWithReturn(searchParams);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [missingToken] = useState(!token);
  const [useWebFlow, setUseWebFlow] = useState(false);
  const androidHandoff = isAndroidDevice() && !!token && !useWebFlow;

  useEffect(() => {
    clearTokens();
  }, []);

  useEffect(() => {
    if (!token || useWebFlow || !isAndroidDevice()) return;
    tryOpenGotchaAuthApp('reset-password', token, searchParams);
  }, [token, useWebFlow, searchParams]);

  const goHome = () => {
    window.location.assign(MARKETING_URL);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      toast.error(copy.authPages.resetLinkMissing);
      return;
    }
    if (password.length < 8) {
      toast.error(copy.authToasts.passwordMinLength);
      return;
    }
    if (password !== confirm) {
      toast.error(copy.settings.passwordsMismatch);
      return;
    }
    setLoading(true);
    try {
      await api('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
      setDone(true);
      toast.success(copy.authPages.resetSuccessToast);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.authPages.couldNotReset);
    } finally {
      setLoading(false);
    }
  };

  if (androidHandoff && !done && !missingToken) {
    return (
      <AuthShell>
        <div className="w-full max-w-[448px] min-w-0">
          <div className="bg-white border border-[#e5e7eb] rounded-2xl p-8 flex flex-col gap-5 shadow-[0_18px_20px_rgba(0,0,0,0.08),0_2px_4px_rgba(0,0,0,0.06)] text-center">
            <h2 className="text-2xl font-extrabold text-[#101828] leading-8">{copy.authPages.openAppTitle}</h2>
            <p className="text-[#6b7280] text-sm leading-5">{copy.authPages.openAppBody}</p>
            <Button
              type="button"
              onClick={() => tryOpenGotchaAuthApp('reset-password', token, searchParams)}
              className="w-full h-11 rounded-[14px] bg-g-blue-700 hover:bg-g-blue-800 font-bold text-sm shadow-[0_10px_12px_rgba(33, 7, 170,0.2)]"
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
        <div className="bg-white border border-[#e5e7eb] rounded-2xl p-8 flex flex-col gap-5 shadow-[0_18px_20px_rgba(0,0,0,0.08),0_2px_4px_rgba(0,0,0,0.06)]">
          {done ? (
            <>
              <div className="flex flex-col gap-1.5 text-center">
                <div className="flex justify-center mb-2">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                </div>
                <h2 className="text-2xl font-extrabold text-[#101828] leading-8">{copy.authPages.resetUpdatedTitle}</h2>
                <p className="text-[#6b7280] text-sm leading-5">
                  {adminReturnUrl ? copy.authPages.resetUpdatedAdminBody : copy.authPages.resetUpdatedBody}
                </p>
              </div>
              <Button
                type="button"
                onClick={() => navigate(loginPath)}
                className="w-full h-11 rounded-[14px] bg-g-blue-700 hover:bg-g-blue-800 font-bold text-sm shadow-[0_10px_12px_rgba(33, 7, 170,0.2)]"
              >
                {copy.auth.signIn}
              </Button>
            </>
          ) : missingToken ? (
            <>
              <div className="flex flex-col gap-1.5">
                <h2 className="text-2xl font-extrabold text-[#101828] leading-8">{copy.authPages.linkInvalidTitle}</h2>
                <p className="text-[#6b7280] text-sm leading-5">{copy.authPages.linkInvalidBody}</p>
              </div>
              <Button
                type="button"
                onClick={() => navigate('/forgot-password')}
                className="w-full h-11 rounded-[14px] bg-g-blue-700 hover:bg-g-blue-800 font-bold text-sm shadow-[0_10px_12px_rgba(33, 7, 170,0.2)]"
              >
                {copy.authPages.forgotTitle}
              </Button>
              <div className="flex items-center justify-between text-[13px] whitespace-nowrap">
                <span className="text-[#6b7280]">{copy.auth.hasAccount}</span>
                <Link to={loginPath} className="text-g-blue-700 font-bold hover:text-g-blue-800">
                  {copy.auth.signIn}
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <h2 className="text-2xl font-extrabold text-[#101828] leading-8">{copy.authPages.resetChooseTitle}</h2>
                <p className="text-[#6b7280] text-sm leading-5">{copy.authPages.resetChooseSubtitle}</p>
              </div>

              <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-[#4a5565]">{copy.settings.newPassword}</label>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={copy.auth.passwordPlaceholderRegister}
                      autoComplete="new-password"
                      className="w-full h-11 pl-3.5 pr-11 bg-[#f9fafb] border border-[#e5e7eb] rounded-[14px] text-sm text-[#101828] placeholder:text-[#9ca3af] outline-none focus:ring-2 focus:ring-g-blue-700/20 focus:border-g-blue-700 focus:bg-white transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#9ca3af] hover:text-[#4a5565]"
                      aria-label={showPass ? copy.auth.hidePassword : copy.auth.showPassword}
                    >
                      {showPass ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-[#4a5565]">{copy.settings.confirmPassword}</label>
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder={copy.authPages.resetConfirmPlaceholder}
                      autoComplete="new-password"
                      className="w-full h-11 pl-3.5 pr-11 bg-[#f9fafb] border border-[#e5e7eb] rounded-[14px] text-sm text-[#101828] placeholder:text-[#9ca3af] outline-none focus:ring-2 focus:ring-g-blue-700/20 focus:border-g-blue-700 focus:bg-white transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#9ca3af] hover:text-[#4a5565]"
                      aria-label={showConfirm ? copy.auth.hidePassword : copy.auth.showPassword}
                    >
                      {showConfirm ? (
                        <EyeOff className="w-[18px] h-[18px]" />
                      ) : (
                        <Eye className="w-[18px] h-[18px]" />
                      )}
                    </button>
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 rounded-[14px] bg-g-blue-700 hover:bg-g-blue-800 font-bold text-sm shadow-[0_10px_12px_rgba(33, 7, 170,0.2)]"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {copy.authPages.saving}
                    </span>
                  ) : (
                    copy.settings.updatePassword
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
          )}
        </div>
      </div>
    </AuthShell>
  );
}
