import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Check, Eye, EyeOff, Lock, Mail, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { AuthShell } from '../components/AuthShell';
import { useAuth } from '../lib/auth';
import { api, clearTokens } from '../lib/api';
import type { SessionResponse, TelegramCodeStep } from '../lib/auth';
import { TelegramBadge, TelegramCodeCard, TelegramLinkWait, telegramAuthCopy, telegramButtonCls } from '../components/auth/TelegramAuth';
import { telegramBotLink } from '../lib/telegram';
import { adminAppUrl, isAllowedAdminReturnUrl } from '../lib/links';
import { authSwitchSearch, authFlowSearch } from '../lib/authRoutes';
import { AuthIcon, authAssets as a } from '../assets/auth';
import { APP_LANGUAGES, type AppLanguage } from '../lib/types';
import { useCatalogLanguages } from '../lib/catalogLanguages';
import { LanguageSearchInput } from '../components/LanguageSearchInput';
import { useLearnerCopy, useLearnerLocale } from '../lib/learnerLocaleContext';
import { SignupSafetyFields } from '../components/safety/SignupSafetyFields';
import { CONSENT_VERSION } from '../components/safety/signupConsent';
import { LegalLinksLine } from '../components/safety/LegalLinksLine';
import { safeLearnerReturnPath } from '../lib/learnerReturn';

/** Sign-up step labels and the password hint (uz / ru / en). */
const SX = {
  en: { step1: 'Account', step2: 'Languages', stepOf: (n: number) => `Step ${n} of 2`, pwRule: 'At least 8 characters' },
  ru: { step1: 'Аккаунт', step2: 'Языки', stepOf: (n: number) => `Шаг ${n} из 2`, pwRule: 'Минимум 8 символов' },
  uz: { step1: 'Hisob', step2: 'Tillar', stepOf: (n: number) => `${n}-qadam, jami 2`, pwRule: 'Kamida 8 ta belgi' },
};

const inputCls =
  'w-full h-12 pl-11 pr-3.5 bg-white border border-[#dfe2ec] rounded-xl text-[15px] text-[#101828] placeholder:text-[#9aa0ae] hover:border-[#c5cafd] focus-visible:outline-none focus-visible:border-[#2107AA] focus-visible:ring-4 focus-visible:ring-[#2107AA]/10 transition-all';

function isAppLanguage(code: string | null): code is AppLanguage {
  return !!code && (APP_LANGUAGES as readonly string[]).includes(code);
}


export default function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { login, register, updateProfile, adoptSession } = useAuth();
  const copy = useLearnerCopy();
  const { locale } = useLearnerLocale();
  // S3 consent (unticked by default) + W-12 optional birth year.
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptAi, setAcceptAi] = useState(false);
  const [birthYear, setBirthYear] = useState<number | null>(null);
  const isLogin = mode === 'login';
  const langParam = searchParams.get('lang');
  const landingLang = isAppLanguage(langParam) ? langParam : null;
  const adminReturnUrl = isAllowedAdminReturnUrl(searchParams.get('returnUrl'));
  // final-6.1a: learners go back to the /app/* page they came from (returnUrl or the ProtectedRoute state), never off-site.
  const fromState = (location.state as { from?: { pathname?: string; search?: string } } | null)?.from;
  const learnerReturn = adminReturnUrl ? null
    : safeLearnerReturnPath(searchParams.get('returnUrl')) ?? (fromState?.pathname ? safeLearnerReturnPath(`${fromState.pathname}${fromState.search ?? ''}`) : null);
  const authQuery = authFlowSearch(searchParams);
  const forgotPasswordTo = authQuery ? `/forgot-password?${authQuery}` : '/forgot-password';
  const seededEmail = (location.state as { email?: string } | null)?.email?.trim() || '';
  const seededName = (location.state as { name?: string } | null)?.name?.trim() || '';

  // Prefill is dev-only: helps local demos handed off from the admin console without
  // exposing the seeded admin's plaintext credentials in a normal-looking learner login
  // form in real deployments (see docs/E2E_AUDIT_REPORT.md's admin-credential-prefill finding).
  const devPrefillEnabled = import.meta.env.DEV;
  const [email, setEmail] = useState(
    seededEmail || (adminReturnUrl && devPrefillEnabled ? 'admin@gotcha.app' : ''),
  );
  const [password, setPassword] = useState(adminReturnUrl && devPrefillEnabled ? (import.meta.env.VITE_DEV_ADMIN_PASSWORD ?? '') : '');
  const [name, setName] = useState(seededName);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  // Phone (Telegram) accounts: code step; "continue with the bot": waiting for the tap in Telegram.
  const [tgCode, setTgCode] = useState<TelegramCodeStep | null>(null);
  const [tgLink, setTgLink] = useState<{ token: string; deepLink: string } | null>(null);
  const [tgLinkBusy, setTgLinkBusy] = useState(false);
  const [phoneLoginHelp, setPhoneLoginHelp] = useState(false);

  // Registration onboarding step: after credentials, pick native + target language(s).
  // Native starts as the UI language. Target comes from the landing `lang` query.
  const [step, setStep] = useState<'credentials' | 'languages'>('credentials');
  const [nativeLanguage, setNativeLanguage] = useState<AppLanguage | null>(
    !isLogin && (locale === 'uz' || locale === 'ru' || locale === 'en') ? locale : null,
  );
  const [targetLanguages, setTargetLanguages] = useState<AppLanguage[]>(
    landingLang ? [landingLang] : [],
  );
  const { langs: catalogLangs } = useCatalogLanguages();

  useEffect(() => {
    // Clear leftover tokens when opening auth screens (once on mount).
    // Do not clear inside submit — that raced with login and wiped the new session.
    clearTokens();
  }, []);

  useEffect(() => {
    setStep('credentials');
  }, [mode]);

  useEffect(() => {
    if (!nativeLanguage) return;
    setTargetLanguages((prev) => prev.filter((l) => l !== nativeLanguage));
  }, [nativeLanguage]);

  useEffect(() => {
    if (!catalogLangs.length) return;
    const codes = catalogLangs.map((l) => l.code);
    setNativeLanguage((prev) => (prev && codes.includes(prev) ? prev : null));
    setTargetLanguages((prev) => prev.filter((l) => codes.includes(l)));
  }, [catalogLangs]);

  const goToLanguageStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      toast.error(copy.authToasts.fillAllFields);
      return;
    }
    if (password.length < 8) {
      toast.error(copy.authToasts.passwordMinLength);
      return;
    }
    setStep('languages');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error(copy.authToasts.fillAllFields);
      return;
    }
    if (!isLogin && !nativeLanguage) {
      toast.error(copy.authToasts.pickNativeLanguage);
      return;
    }
    if (!isLogin && targetLanguages.length === 0) {
      toast.error(copy.authToasts.pickTargetLanguage);
      return;
    }
    setLoading(true);
    try {
      if (isLogin) {
        const session = await login(email, password);
        if (session.telegramCode) {
          setTgCode(session.telegramCode);
          return;
        }
        // Admin accounts always go to the admin console (explicit returnUrl or default).
        const handoffTarget = adminReturnUrl || (session.isAdmin ? adminAppUrl() : null);
        if (handoffTarget) {
          if (!session.isAdmin) {
            toast.error(copy.authToasts.noAdminAccess);
            navigate('/app', { replace: true });
            return;
          }
          // Leave tokens only for the admin app (hash handoff); avoid a lingering learner session.
          clearTokens();
          const handoff = new URL(handoffTarget);
          handoff.hash = new URLSearchParams({
            accessToken: session.accessToken,
            refreshToken: session.refreshToken,
          }).toString();
          toast.success(copy.authToasts.welcomeBack);
          window.location.assign(handoff.toString());
          return;
        }
        if (searchParams.get('returnUrl') && !learnerReturn) {
          toast.message(copy.authToasts.signedInLearner);
        } else {
          toast.success(copy.authToasts.welcomeBack);
        }
        navigate(learnerReturn ?? '/app', { replace: true });
      } else {
        if (!nativeLanguage) {
          toast.error(copy.authToasts.pickNativeLanguage);
          return;
        }
        const result = await register({
          email,
          password,
          displayName: name || undefined,
          nativeLanguage,
          targetLanguages,
          uiLanguage: locale,
          acceptTerms,
          acceptAiConsent: acceptAi,
          ...(acceptTerms ? { consentVersion: CONSENT_VERSION } : {}),
          ...(birthYear != null ? { birthYear } : {}),
        });
        if (result.requiresEmailVerification) {
          toast.success(copy.authToasts.checkInbox);
          navigate(`/verify-email?email=${encodeURIComponent(result.email || email)}&lang=${locale}`);
          return;
        }
        try {
          await updateProfile({ uiLanguage: locale });
        } catch {
          /* non-blocking */
        }
        toast.success(copy.authToasts.accountCreated);
        navigate(learnerReturn ?? '/app', { replace: true });
      }
    } catch (err) {
      const e = err as Error & { code?: string; email?: string; status?: number };
      if (e.code === 'EMAIL_NOT_VERIFIED' || /verify your email/i.test(e.message || '')) {
        toast.message(copy.authToasts.verifyBeforeSignIn);
        const verifyQ = authFlowSearch(searchParams, { email: e.email || email });
        navigate(verifyQ ? `/verify-email?${verifyQ}` : `/verify-email?email=${encodeURIComponent(e.email || email)}`);
        return;
      }
      if (
        e.code === 'EMAIL_EXISTS_UNVERIFIED' ||
        (e.status === 409 && /not verified/i.test(e.message || ''))
      ) {
        toast.message(copy.authToasts.accountExistsUnverified);
        const verifyQ = authFlowSearch(searchParams, { email: e.email || email });
        navigate(verifyQ ? `/verify-email?${verifyQ}` : `/verify-email?email=${encodeURIComponent(e.email || email)}`);
        return;
      }
      if (
        e.code === 'EMAIL_ALREADY_REGISTERED' ||
        e.status === 409 ||
        /already (registered|exists)/i.test(e.message || '')
      ) {
        toast.error(copy.authToasts.accountExistsSignIn);
        const q = authSwitchSearch(searchParams, 'login');
        navigate(
          { pathname: '/login', search: q ? `?${q}` : '' },
          { replace: true, state: { email } },
        );
        return;
      }
      // Phone sign-in failed: a phone account exists only if it was opened in the Telegram bot — say so clearly.
      if (isLogin && email.trim() && !email.includes('@') && (e.status === 401 || e.status === 400)) {
        setPhoneLoginHelp(true);
        return;
      }
      toast.error(err instanceof Error ? err.message : copy.authToasts.authFailed);
    } finally {
      setLoading(false);
    }
  };

  const tx = telegramAuthCopy(locale);
  const homeAfterAuth = learnerReturn ?? '/app';
  const finishTelegramSignIn = useCallback(
    async (session: SessionResponse) => {
      await adoptSession(session);
      toast.success(copy.authToasts.welcomeBack);
      navigate(homeAfterAuth, { replace: true });
    },
    [adoptSession, copy.authToasts.welcomeBack, navigate, homeAfterAuth],
  );
  const cancelTelegramLink = useCallback(() => setTgLink(null), []);

  const startBotLogin = async () => {
    // Open the tab synchronously (popup blockers), then point it at the bot once the link exists.
    const win = window.open('', '_blank');
    setTgLinkBusy(true);
    try {
      const r = await api<{ token: string; deepLink: string }>('/auth/telegram/login-link', { method: 'POST' });
      if (win) win.location.href = r.deepLink;
      setTgLink(r);
    } catch {
      win?.close();
      toast.error(tx.unavailable);
    } finally {
      setTgLinkBusy(false);
    }
  };

  const goingTo = isLogin ? 'register' : 'login';
  const switchSearch = authSwitchSearch(searchParams, goingTo);
  const switchTo = {
    pathname: isLogin ? '/register' : '/login',
    search: switchSearch ? `?${switchSearch}` : '',
  };

  const showLanguageStep = !isLogin && step === 'languages';
  const sx = SX[locale === 'ru' || locale === 'uz' ? locale : 'en'];
  const pwOk = password.length >= 8;

  return (
    <AuthShell>
      <div className="w-full max-w-[448px] min-w-0">
        <div className="bg-white border border-[#e6e8f0] rounded-[20px] p-5 sm:p-8 flex flex-col gap-6 shadow-[0_24px_48px_-24px_rgba(16,24,40,0.18)]">
          {tgCode ? (
            <TelegramCodeCard t={tx} challengeId={tgCode.challengeId} maskedPhone={tgCode.maskedPhone} onSession={finishTelegramSignIn} onBack={() => setTgCode(null)} />
          ) : tgLink ? (
            <TelegramLinkWait t={tx} token={tgLink.token} deepLink={tgLink.deepLink} onSession={finishTelegramSignIn} onCancel={cancelTelegramLink} />
          ) : (
          <>
          {!isLogin && (
            <div className="flex items-center gap-3" aria-label={sx.stepOf(showLanguageStep ? 2 : 1)}>
              {[sx.step1, sx.step2].map((label, i) => {
                const n = i + 1;
                const current = (showLanguageStep ? 2 : 1) === n;
                const done = showLanguageStep && n === 1;
                return (
                  <div key={label} className="flex items-center gap-2 flex-1 min-w-0">
                    <span className={`size-6 shrink-0 rounded-full grid place-items-center text-xs font-bold ${done ? 'bg-emerald-500 text-white' : current ? 'bg-g-blue-700 text-white' : 'bg-[#eef0f5] text-[#8a8fa0]'}`}>
                      {done ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : n}
                    </span>
                    <span className={`text-[13px] font-semibold truncate ${current ? 'text-[#101828]' : 'text-[#8a8fa0]'}`}>{label}</span>
                    {n === 1 && <span className={`h-px flex-1 ${showLanguageStep ? 'bg-emerald-300' : 'bg-[#e6e8f0]'}`} />}
                  </div>
                );
              })}
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <h2 className="text-[26px] font-extrabold tracking-tight text-[#101828] leading-8">
              {isLogin ? copy.auth.welcomeBack : showLanguageStep ? copy.auth.whatToLearn : copy.auth.createAccount}
            </h2>
            <p className="text-[#6b7280] text-sm leading-5">
              {isLogin
                ? adminReturnUrl
                  ? copy.auth.signInAdminSubtitle
                  : copy.auth.signInSubtitle
                : showLanguageStep
                  ? copy.auth.languageStepSubtitle
                  : copy.auth.signUpSubtitle}
            </p>
            {!isLogin && !showLanguageStep && (
              <div className="mt-1 flex flex-wrap gap-1.5">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700">
                  <AuthIcon src={a.check} size={16} />
                  {copy.auth.freeForeverBadge}
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-[#f3f0ff] border border-g-blue-200 px-3 py-1 text-xs font-semibold text-g-blue-700">
                  <AuthIcon src={a.sparkles} size={16} />
                  {copy.auth.payPerImportBadge}
                </div>
              </div>
            )}
          </div>

          {showLanguageStep ? (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label id="auth-native-label" className="text-[13px] font-semibold text-[#344054]">{copy.auth.nativeLanguage}</label>
                <LanguageSearchInput
                  labelledBy="auth-native-label"
                  options={catalogLangs}
                  value={nativeLanguage ? [nativeLanguage] : []}
                  onChange={(codes) => setNativeLanguage((codes[0] as AppLanguage) ?? null)}
                  multiple={false}
                  placeholder={copy.auth.nativeLanguagePlaceholder}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label id="auth-target-label" className="text-[13px] font-semibold text-[#344054]">
                  {copy.auth.targetLanguages}{' '}
                  <span className="text-[#4a5565] font-normal">{copy.auth.targetLanguagesHint}</span>
                </label>
                <LanguageSearchInput
                  options={catalogLangs}
                  labelledBy="auth-target-label"
                  value={targetLanguages}
                  onChange={(codes) => setTargetLanguages(codes as AppLanguage[])}
                  exclude={nativeLanguage ? [nativeLanguage] : []}
                  placeholder={copy.auth.targetLanguagesPlaceholder}
                />
              </div>
              {/* WL4-07: consent + birth year sit ABOVE Create account so they are in view at 360x640. */}
              <SignupSafetyFields
                locale={locale}
                accepted={acceptTerms}
                onAccepted={setAcceptTerms}
                aiAccepted={acceptAi}
                onAiAccepted={setAcceptAi}
                birthYear={birthYear}
                onBirthYear={setBirthYear}
              />
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep('credentials')}
                  className="h-12 rounded-xl font-bold text-sm px-5"
                >
                  {copy.common.back}
                </Button>
                <Button
                  type="submit"
                  disabled={loading || !nativeLanguage || targetLanguages.length === 0 || !acceptTerms || !acceptAi}
                  className="flex-1 h-12 rounded-xl bg-g-blue-700 hover:bg-g-blue-800 font-bold text-[15px] shadow-[0_10px_20px_-8px_rgba(33,7,170,0.45)]"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {copy.auth.creatingAccount}
                    </span>
                  ) : (
                    copy.auth.createFreeAccount
                  )}
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={isLogin ? handleSubmit : goToLanguageStep} className="flex flex-col gap-4">
              {!isLogin && (
                <div className="flex flex-col gap-2">
                  <label htmlFor="auth-name" className="text-[13px] font-semibold text-[#344054]">{copy.auth.fullName}</label>
                  <div className="relative">
                  <UserRound className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#9aa0ae]" />
                  <input
                    id="auth-name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={copy.auth.namePlaceholder}
                    className={inputCls}
                  />
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-2">
                <label htmlFor="auth-email" className="text-[13px] font-semibold text-[#344054]">{isLogin ? tx.identifier : copy.auth.email}</label>
                <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#9aa0ae]" />
                <input
                  id="auth-email"
                  name="email"
                  type={isLogin ? 'text' : 'email'}
                  autoComplete={isLogin ? 'username' : 'email'}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setPhoneLoginHelp(false); }}
                  placeholder={isLogin ? tx.identifierPlaceholder : copy.auth.emailPlaceholder}
                  className={inputCls}
                />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="auth-password" className="text-[13px] font-semibold text-[#344054]">{copy.auth.password}</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#9aa0ae]" />
                  <input
                    id="auth-password"
                    name="password"
                    type={showPass ? 'text' : 'password'}
                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={isLogin ? copy.auth.passwordPlaceholderLogin : copy.auth.passwordPlaceholderRegister}
                    className={`${inputCls} !pr-12`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((s) => !s)}
                    className="absolute right-1 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-xl text-[#4a5565] hover:text-[#101828] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2107AA]"
                    aria-label={showPass ? copy.auth.hidePassword : copy.auth.showPassword}
                  >
                    {showPass ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                  </button>
                </div>
                {!isLogin && (
                  <p className={`flex items-center gap-1.5 text-xs font-medium ${pwOk ? 'text-emerald-600' : 'text-[#8a8fa0]'}`}>
                    <Check className="w-3.5 h-3.5" strokeWidth={pwOk ? 3 : 2} />
                    {sx.pwRule}
                  </p>
                )}
              </div>
              {isLogin && (
                <div className="flex items-center justify-end">
                  <Link
                    to={forgotPasswordTo}
                    className="inline-flex min-h-11 items-center rounded-lg text-[13px] font-semibold text-g-blue-700 hover:text-g-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2107AA]"
                  >
                    {copy.auth.forgotPassword}
                  </Link>
                </div>
              )}
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-xl bg-g-blue-700 hover:bg-g-blue-800 font-bold text-[15px] shadow-[0_10px_20px_-8px_rgba(33,7,170,0.45)]"
              >
                {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {isLogin ? copy.auth.signingIn : copy.auth.continuing}
                    </span>
                  ) : isLogin ? (
                    copy.auth.signIn
                  ) : (
                    copy.common.continue
                  )}
              </Button>
              {isLogin && phoneLoginHelp && (
                <div role="alert" className="-mt-1.5 rounded-xl border border-[#fde68a] bg-[#fffbeb] p-3.5 text-[13px] leading-relaxed text-[#92400e]">
                  <b className="block text-[13.5px]">{tx.phoneLoginFailTitle}</b>
                  {tx.phoneLoginFailBody}
                  <a href={telegramBotLink('signup')} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-block font-bold text-[#1d5f96] underline underline-offset-2">
                    {tx.signupWithBot}
                  </a>
                </div>
              )}
              {isLogin && !adminReturnUrl && (
                <button type="button" onClick={() => void startBotLogin()} disabled={tgLinkBusy} className={`-mt-1.5 ${telegramButtonCls}`}>
                  <TelegramBadge />
                  {tx.continueWithBot}
                </button>
              )}
              {!isLogin && (
                <div className="-mt-1.5 flex flex-col gap-2">
                  <a href={telegramBotLink('signup')} target="_blank" rel="noopener noreferrer" className={telegramButtonCls}>
                    <TelegramBadge />
                    {tx.signupWithBot}
                  </a>
                  <p className="text-center text-xs text-[#6b7280]">{tx.botHint}</p>
                </div>
              )}
              {/* WL4-07: no "By continuing, you agree…" on step 1; agreement is the step-2 tick-box only. WLF-36: plain links. */}
              {!isLogin && <LegalLinksLine locale={locale} />}
            </form>
          )}

          {/* final-5: admin sign-in never offers 'Sign up free'. */}
          {!adminReturnUrl && (
          <div className="flex items-center justify-center gap-1.5 text-sm flex-wrap border-t border-[#eef0f5] pt-5">
            <span className="text-[#6b7280]">
              {isLogin ? copy.auth.noAccount : copy.auth.hasAccount}
            </span>
            <Link
              replace
              to={switchTo}
              state={{ email, name }}
              className="inline-flex min-h-11 items-center rounded-lg text-g-blue-700 font-bold hover:text-g-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2107AA]"
            >
              {isLogin ? copy.auth.signUpFree : copy.auth.signIn}
            </Link>
          </div>
          )}
          </>
          )}
        </div>


      </div>
    </AuthShell>
  );
}
