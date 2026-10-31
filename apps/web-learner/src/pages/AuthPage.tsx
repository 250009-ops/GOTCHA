import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { AuthShell } from '../components/AuthShell';
import { useAuth } from '../lib/auth';
import { clearTokens } from '../lib/api';
import { adminAppUrl, isAllowedAdminReturnUrl, MARKETING_URL } from '../lib/links';
import { authSwitchSearch, authFlowSearch } from '../lib/authRoutes';
import { AuthIcon, authAssets as a } from '../assets/auth';
import { APP_LANGUAGES, type AppLanguage } from '../lib/types';
import { useCatalogLanguages } from '../lib/catalogLanguages';
import { LanguageSearchInput } from '../components/LanguageSearchInput';
import { useLearnerCopy, useLearnerLocale } from '../lib/learnerLocaleContext';
import { SignupSafetyFields } from '../components/safety/SignupSafetyFields';

function isAppLanguage(code: string | null): code is AppLanguage {
  return !!code && (APP_LANGUAGES as readonly string[]).includes(code);
}

function LegalConsent() {
  const copy = useLearnerCopy();
  const termsHref = `${MARKETING_URL}/terms`;
  const privacyHref = `${MARKETING_URL}/privacy`;
  return (
    <p className="text-center text-[12px] leading-[18px] text-[#9ca3af]">
      {copy.auth.legalPrefix}{' '}
      <a
        href={termsHref}
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-[#6b7280] underline decoration-[#d1d5db] underline-offset-[3px] hover:text-g-blue-700 hover:decoration-g-blue-700"
      >
        {copy.auth.termsOfUse}
      </a>{' '}
      {copy.auth.legalAnd}{' '}
      <a
        href={privacyHref}
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-[#6b7280] underline decoration-[#d1d5db] underline-offset-[3px] hover:text-g-blue-700 hover:decoration-g-blue-700"
      >
        {copy.auth.privacyPolicy}
      </a>
      {copy.auth.legalSuffix}
    </p>
  );
}

export default function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { login, register, updateProfile } = useAuth();
  const copy = useLearnerCopy();
  const { locale } = useLearnerLocale();
  // S3 consent (unticked by default) + W-12 optional birth year.
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [birthYear, setBirthYear] = useState<number | null>(null);
  const isLogin = mode === 'login';
  const plan = searchParams.get('plan');
  const langParam = searchParams.get('lang');
  const landingLang = isAppLanguage(langParam) ? langParam : null;
  const adminReturnUrl = isAllowedAdminReturnUrl(searchParams.get('returnUrl'));
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

  // Registration onboarding step: after credentials, pick native + target language(s).
  // Prefill target from the landing `lang` query only. Native starts empty so the
  // learner chooses it themselves — do not default to English (or any other language).
  const [step, setStep] = useState<'credentials' | 'languages'>('credentials');
  const [nativeLanguage, setNativeLanguage] = useState<AppLanguage | null>(null);
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
        if (searchParams.get('returnUrl')) {
          toast.message(copy.authToasts.signedInLearner);
        } else {
          toast.success(copy.authToasts.welcomeBack);
        }
        navigate('/app', { replace: true });
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
          ...(birthYear != null ? { birthYear } : {}),
        });
        if (result.requiresEmailVerification) {
          toast.success(copy.authToasts.checkInbox);
          navigate(`/verify-email?email=${encodeURIComponent(result.email || email)}`);
          return;
        }
        try {
          await updateProfile({ uiLanguage: locale });
        } catch {
          /* non-blocking */
        }
        toast.success(copy.authToasts.accountCreated);
        navigate('/app', { replace: true });
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
      toast.error(err instanceof Error ? err.message : copy.authToasts.authFailed);
    } finally {
      setLoading(false);
    }
  };

  const goHome = () => {
    window.location.assign(MARKETING_URL);
  };

  const goingTo = isLogin ? 'register' : 'login';
  const switchSearch = authSwitchSearch(searchParams, goingTo);
  const switchTo = {
    pathname: isLogin ? '/register' : '/login',
    search: switchSearch ? `?${switchSearch}` : '',
  };

  const showLanguageStep = !isLogin && step === 'languages';

  return (
    <AuthShell>
      <div className="w-full max-w-[448px] min-w-0">
        <div className="bg-white border-[0.8px] border-[#e5e7eb] rounded-2xl p-5 sm:p-8 flex flex-col gap-5 shadow-[0_18px_20px_rgba(0,0,0,0.08),0_2px_4px_rgba(0,0,0,0.06)]">
          <div className="flex flex-col gap-1.5">
            <h2 className="text-2xl font-extrabold text-[#101828] leading-8">
              {isLogin ? copy.auth.welcomeBack : showLanguageStep ? copy.auth.whatToLearn : copy.auth.createAccount}
            </h2>
            <p className="text-[#6b7280] text-sm leading-5">
              {isLogin
                ? adminReturnUrl
                  ? copy.auth.signInAdminSubtitle
                  : copy.auth.signInSubtitle
                : showLanguageStep
                  ? copy.auth.languageStepSubtitle
                  : plan === 'pay-per-import'
                    ? copy.auth.signUpSubtitle
                    : copy.auth.signUpSubtitle}
            </p>
            {!isLogin && !showLanguageStep && plan === 'pay-per-import' && (
              <div className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-[#f3f0ff] border border-g-blue-200 px-3 py-1 text-xs font-semibold text-g-blue-700 self-start">
                <AuthIcon src={a.sparkles} size={16} />
                {copy.auth.payPerImportBadge}
              </div>
            )}
            {!isLogin && !showLanguageStep && plan === 'free' && (
              <div className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700 self-start">
                <AuthIcon src={a.check} size={16} />
                {copy.auth.freeForeverBadge}
              </div>
            )}
          </div>

          {showLanguageStep ? (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-[#4a5565]">{copy.auth.nativeLanguage}</label>
                <LanguageSearchInput
                  options={catalogLangs}
                  value={nativeLanguage ? [nativeLanguage] : []}
                  onChange={(codes) => setNativeLanguage((codes[0] as AppLanguage) ?? null)}
                  multiple={false}
                  placeholder={copy.auth.nativeLanguagePlaceholder}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-[#4a5565]">
                  {copy.auth.targetLanguages}{' '}
                  <span className="text-[#9ca3af] font-normal">{copy.auth.targetLanguagesHint}</span>
                </label>
                <LanguageSearchInput
                  options={catalogLangs}
                  value={targetLanguages}
                  onChange={(codes) => setTargetLanguages(codes as AppLanguage[])}
                  exclude={nativeLanguage ? [nativeLanguage] : []}
                  placeholder={copy.auth.targetLanguagesPlaceholder}
                />
              </div>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep('credentials')}
                  className="h-11 rounded-[14px] font-bold text-sm px-4"
                >
                  {copy.common.back}
                </Button>
                <Button
                  type="submit"
                  disabled={loading || !nativeLanguage || targetLanguages.length === 0 || !acceptTerms}
                  className="flex-1 h-11 rounded-[14px] bg-g-blue-700 hover:bg-g-blue-800 font-bold text-sm shadow-[0_10px_12px_rgba(33, 7, 170,0.2)]"
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
              <SignupSafetyFields
                locale={locale}
                accepted={acceptTerms}
                onAccepted={setAcceptTerms}
                birthYear={birthYear}
                onBirthYear={setBirthYear}
              />
            </form>
          ) : (
            <form onSubmit={isLogin ? handleSubmit : goToLanguageStep} className="flex flex-col gap-4">
              {!isLogin && (
                <div className="flex flex-col gap-2">
                  <label htmlFor="auth-name" className="text-xs font-semibold text-[#4a5565]">{copy.auth.fullName}</label>
                  <input
                    id="auth-name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Chen"
                    className="w-full h-11 px-3.5 bg-[#f9fafb] border border-[#e5e7eb] rounded-[14px] text-sm text-[#101828] placeholder:text-[#9ca3af] outline-none focus:ring-2 focus:ring-g-blue-700/20 focus:border-g-blue-700 focus:bg-white transition-all"
                  />
                </div>
              )}
              <div className="flex flex-col gap-2">
                <label htmlFor="auth-email" className="text-xs font-semibold text-[#4a5565]">{copy.auth.email}</label>
                <input
                  id="auth-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full h-11 px-3.5 bg-[#f9fafb] border border-[#e5e7eb] rounded-[14px] text-sm text-[#101828] placeholder:text-[#9ca3af] outline-none focus:ring-2 focus:ring-g-blue-700/20 focus:border-g-blue-700 focus:bg-white transition-all"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="auth-password" className="text-xs font-semibold text-[#4a5565]">{copy.auth.password}</label>
                <div className="relative">
                  <input
                    id="auth-password"
                    name="password"
                    type={showPass ? 'text' : 'password'}
                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={isLogin ? copy.auth.passwordPlaceholderLogin : copy.auth.passwordPlaceholderRegister}
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
              {isLogin && (
                <div className="flex items-center justify-end">
                  <Link
                    to={forgotPasswordTo}
                    className="text-[13px] font-semibold text-g-blue-700 hover:text-g-blue-800"
                  >
                    {copy.auth.forgotPassword}
                  </Link>
                </div>
              )}
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-[14px] bg-g-blue-700 hover:bg-g-blue-800 font-bold text-sm shadow-[0_10px_12px_rgba(33, 7, 170,0.2)]"
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
              {!isLogin && <LegalConsent />}
            </form>
          )}

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-[#e5e7eb]" />
            <span className="text-xs text-[#9ca3af]">{copy.common.or}</span>
            <div className="flex-1 h-px bg-[#e5e7eb]" />
          </div>

          <div className="flex items-center justify-between gap-3 text-[13px] whitespace-nowrap">
            <span className="text-[#6b7280]">
              {isLogin ? copy.auth.noAccount : copy.auth.hasAccount}
            </span>
            <Link
              replace
              to={switchTo}
              state={{ email, name }}
              className="text-g-blue-700 font-bold hover:text-g-blue-800"
            >
              {isLogin ? copy.auth.signUpFree : copy.auth.signIn}
            </Link>
          </div>
        </div>

        <button
          type="button"
          onClick={goHome}
          className="mt-5 flex items-center gap-1.5 text-sm font-medium text-[#99a1af] hover:text-[#4a5565] mx-auto"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {copy.auth.backToHomepage}
        </button>
      </div>
    </AuthShell>
  );
}
