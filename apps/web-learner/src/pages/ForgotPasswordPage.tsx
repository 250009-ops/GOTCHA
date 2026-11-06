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
import { useLearnerCopy, useLearnerLocale } from '../lib/learnerLocaleContext';
import { telegramAuthCopy } from '../components/auth/TelegramAuth';

/** Phone (Telegram) reset strings (uz / ru / en). */
const FX = {
  uz: { title: 'Telegramdagi kodni kiriting', body: (p: string) => `${p} raqamli hisob uchun Gotcha botiga 6 xonali kod yubordik.`, code: 'Kod', newPw: 'Yangi parol', pwRule: 'Kamida 8 ta belgi', save: 'Parolni yangilash', done: 'Parol yangilandi. Endi kirishingiz mumkin.', maybe: 'Agar bu raqam bilan hisob boʻlsa, kod Telegramga yuborildi.' },
  ru: { title: 'Введите код из Telegram', body: (p: string) => `Мы отправили 6-значный код в бота Gotcha для аккаунта ${p}.`, code: 'Код', newPw: 'Новый пароль', pwRule: 'Минимум 8 символов', save: 'Обновить пароль', done: 'Пароль обновлён. Теперь можно войти.', maybe: 'Если аккаунт с этим номером есть, код отправлен в Telegram.' },
  en: { title: 'Enter the code from Telegram', body: (p: string) => `We sent a 6-digit code to the Gotcha bot for ${p}.`, code: 'Code', newPw: 'New password', pwRule: 'At least 8 characters', save: 'Update password', done: 'Password updated. You can sign in now.', maybe: 'If an account exists for this number, we sent a code to Telegram.' },
};

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
  const { locale } = useLearnerLocale();
  const tx = telegramAuthCopy(locale);
  const fx = FX[locale === 'ru' || locale === 'en' ? locale : 'uz'];
  const isPhone = !!email.trim() && !email.includes('@');
  const [phoneReset, setPhoneReset] = useState<{ challengeId: string; maskedPhone: string } | null>(null);
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

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
      if (isPhone) {
        // Phone accounts were opened in Telegram: the reset code arrives in the bot.
        const r = await api<{ challengeId?: string; maskedPhone?: string }>('/auth/forgot-password', {
          method: 'POST',
          body: JSON.stringify({ identifier: email.trim(), clientPlatform: 'web' }),
        });
        if (r.challengeId && r.maskedPhone) setPhoneReset({ challengeId: r.challengeId, maskedPhone: r.maskedPhone });
        else toast.message(fx.maybe);
        return;
      }
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

  const submitPhoneReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneReset || resetCode.replace(/\D/g, '').length !== 6 || newPassword.length < 8) return;
    setLoading(true);
    try {
      await api('/auth/reset-password/telegram', {
        method: 'POST',
        body: JSON.stringify({ challengeId: phoneReset.challengeId, code: resetCode.replace(/\D/g, ''), password: newPassword }),
      });
      toast.success(fx.done);
      navigate(loginPath, { replace: true });
    } catch (err) {
      const c = (err as { code?: string }).code;
      toast.error(c === 'telegram_code_expired' ? tx.expired : tx.wrongCode);
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
          {phoneReset ? (
            <form onSubmit={(e) => void submitPhoneReset(e)} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <h2 className="text-[26px] font-extrabold tracking-tight text-[#101828] leading-8">{fx.title}</h2>
                <p className="text-[#6b7280] text-sm leading-5">{fx.body(phoneReset.maskedPhone)}</p>
              </div>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-[#4a5565]">{fx.code}</span>
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={7}
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value.replace(/[^\d ]/g, ''))}
                  className="w-full h-12 px-3.5 bg-white border border-[#dfe2ec] rounded-xl text-[20px] font-bold tracking-[0.3em] text-[#101828] outline-none focus:border-g-blue-700 focus:ring-4 focus:ring-g-blue-700/10"
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-[#4a5565]">{fx.newPw}</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full h-12 px-3.5 bg-white border border-[#dfe2ec] rounded-xl text-[15px] text-[#101828] outline-none focus:border-g-blue-700 focus:ring-4 focus:ring-g-blue-700/10"
                />
                <span className={`text-xs font-medium ${newPassword.length >= 8 ? 'text-emerald-600' : 'text-[#8a8fa0]'}`}>{fx.pwRule}</span>
              </label>
              <Button
                type="submit"
                disabled={loading || resetCode.replace(/\D/g, '').length !== 6 || newPassword.length < 8}
                className="w-full h-12 rounded-xl bg-g-blue-700 hover:bg-g-blue-800 font-bold text-[15px] shadow-[0_10px_20px_-8px_rgba(33,7,170,0.45)]"
              >
                {fx.save}
              </Button>
              <button type="button" onClick={() => setPhoneReset(null)} className="flex items-center justify-center gap-2 text-[13px] text-[#6b7280] hover:text-[#4a5565] w-full">
                <ArrowLeft className="w-4 h-4" />
                {tx.back}
              </button>
            </form>
          ) : !sent ? (
            <>
              <div className="flex flex-col gap-1.5">
                <h2 className="text-[26px] font-extrabold tracking-tight text-[#101828] leading-8">{copy.authPages.forgotTitle}</h2>
                <p className="text-[#6b7280] text-sm leading-5">
                  {adminReturnUrl ? copy.authPages.forgotAdminSubtitle : copy.authPages.forgotSubtitle}
                </p>
              </div>

              <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-[#4a5565]">{tx.identifier}</label>
                  <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#9aa0ae]" />
                  <input
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={tx.identifierPlaceholder}
                    autoComplete="username"
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
