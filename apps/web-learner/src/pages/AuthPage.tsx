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

function isAppLanguage(code: string | null): code is AppLanguage {
  return !!code && (APP_LANGUAGES as readonly string[]).includes(code);
}

function LegalConsent() {
  const termsHref = `${MARKETING_URL}/terms`;
  const privacyHref = `${MARKETING_URL}/privacy`;
  return (
    <p className="text-center text-[12px] leading-[18px] text-[#9ca3af]">
      By continuing, you agree to GOTCHA's{' '}
      <a
        href={termsHref}
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-[#6b7280] underline decoration-[#d1d5db] underline-offset-[3px] hover:text-[#7f22fe] hover:decoration-[#7f22fe]"
      >
        Terms of Use
      </a>{' '}
      and{' '}
      <a
        href={privacyHref}
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-[#6b7280] underline decoration-[#d1d5db] underline-offset-[3px] hover:text-[#7f22fe] hover:decoration-[#7f22fe]"
      >
        Privacy Policy
      </a>
      .
    </p>
  );
}

export default function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { login, register } = useAuth();
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
  const [password, setPassword] = useState(adminReturnUrl && devPrefillEnabled ? '<REDACTED-admin-pw>' : '');
  const [name, setName] = useState(seededName);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  // Registration onboarding step: after credentials, pick native + target language(s).
  // Prefill target from the landing `lang` query — never hardcode a sample language.
  // If they chose English on the homepage, default native to Uzbek so the two don't collide.
  const [step, setStep] = useState<'credentials' | 'languages'>('credentials');
  const [nativeLanguage, setNativeLanguage] = useState<AppLanguage>(
    landingLang === 'en' ? 'uz' : 'en',
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
    setTargetLanguages((prev) => prev.filter((l) => l !== nativeLanguage));
  }, [nativeLanguage]);

  useEffect(() => {
    if (!catalogLangs.length) return;
    const codes = catalogLangs.map((l) => l.code);
    setNativeLanguage((prev) => (codes.includes(prev) ? prev : (codes[0] as AppLanguage)));
    setTargetLanguages((prev) => prev.filter((l) => codes.includes(l)));
  }, [catalogLangs]);

  const goToLanguageStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      toast.error('Please fill in all fields');
      return;
    }
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setStep('languages');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }
    if (!isLogin && targetLanguages.length === 0) {
      toast.error('Pick at least one language to learn');
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
            toast.error('This account does not have admin access');
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
          toast.success('Welcome back!');
          window.location.assign(handoff.toString());
          return;
        }
        if (searchParams.get('returnUrl')) {
          // returnUrl was present but rejected (wrong origin) — stay in learner.
          toast.message('Signed in to the learner app');
        } else {
          toast.success('Welcome back!');
        }
        navigate('/app', { replace: true });
      } else {
        const result = await register({
          email,
          password,
          displayName: name || undefined,
          nativeLanguage,
          targetLanguages,
        });
        if (result.requiresEmailVerification) {
          toast.success('Check your inbox to verify your email');
          navigate(`/verify-email?email=${encodeURIComponent(result.email || email)}`);
          return;
        }
        toast.success('Account created!');
        navigate('/app', { replace: true });
      }
    } catch (err) {
      const e = err as Error & { code?: string; email?: string; status?: number };
      if (e.code === 'EMAIL_NOT_VERIFIED' || /verify your email/i.test(e.message || '')) {
        toast.message('Please verify your email before signing in');
        const verifyQ = authFlowSearch(searchParams, { email: e.email || email });
        navigate(verifyQ ? `/verify-email?${verifyQ}` : `/verify-email?email=${encodeURIComponent(e.email || email)}`);
        return;
      }
      if (
        e.code === 'EMAIL_EXISTS_UNVERIFIED' ||
        (e.status === 409 && /not verified/i.test(e.message || ''))
      ) {
        toast.message('Account already exists — check your inbox or resend verification');
        const verifyQ = authFlowSearch(searchParams, { email: e.email || email });
        navigate(verifyQ ? `/verify-email?${verifyQ}` : `/verify-email?email=${encodeURIComponent(e.email || email)}`);
        return;
      }
      if (
        e.code === 'EMAIL_ALREADY_REGISTERED' ||
        e.status === 409 ||
        /already (registered|exists)/i.test(e.message || '')
      ) {
        toast.error('Account already exists — sign in instead');
        const q = authSwitchSearch(searchParams, 'login');
        navigate(
          { pathname: '/login', search: q ? `?${q}` : '' },
          { replace: true, state: { email } },
        );
        return;
      }
      toast.error(err instanceof Error ? err.message : 'Authentication failed');
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
              {isLogin ? 'Welcome back' : showLanguageStep ? 'What do you want to learn?' : 'Create your account'}
            </h2>
            <p className="text-[#6b7280] text-sm leading-5">
              {isLogin
                ? adminReturnUrl
                  ? 'Sign in with your admin account to open the admin console.'
                  : 'Sign in to continue your reading journey.'
                : showLanguageStep
                  ? 'Search and add the language you want to learn. You can add more later in Settings.'
                  : plan === 'pay-per-import'
                    ? 'Create your free account — pay only if you need more than your free imports.'
                    : 'Sign up to start your reading journey.'}
            </p>
            {!isLogin && !showLanguageStep && plan === 'pay-per-import' && (
              <div className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-[#f3f0ff] border border-[#ddd6fe] px-3 py-1 text-xs font-semibold text-[#7f22fe] self-start">
                <AuthIcon src={a.sparkles} size={16} />
                No subscription — pay per import via Atmos
              </div>
            )}
            {!isLogin && !showLanguageStep && plan === 'free' && (
              <div className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700 self-start">
                <AuthIcon src={a.check} size={16} />
                Free forever plan
              </div>
            )}
          </div>

          {showLanguageStep ? (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-[#4a5565]">Your native language</label>
                <LanguageSearchInput
                  options={catalogLangs}
                  value={[nativeLanguage]}
                  onChange={(codes) => {
                    const next = (codes[0] ?? catalogLangs[0]?.code ?? 'en') as AppLanguage;
                    setNativeLanguage(next);
                  }}
                  multiple={false}
                  placeholder="Search your native language..."
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-[#4a5565]">
                  Languages you want to learn{' '}
                  <span className="text-[#9ca3af] font-normal">(search and add at least one)</span>
                </label>
                <LanguageSearchInput
                  options={catalogLangs}
                  value={targetLanguages}
                  onChange={(codes) => setTargetLanguages(codes as AppLanguage[])}
                  exclude={[nativeLanguage]}
                  placeholder="Search a language to add..."
                />
              </div>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep('credentials')}
                  className="h-11 rounded-[14px] font-bold text-sm px-4"
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={loading || targetLanguages.length === 0}
                  className="flex-1 h-11 rounded-[14px] bg-[#7f22fe] hover:bg-[#6b1fd8] font-bold text-sm shadow-[0_10px_12px_rgba(127,34,254,0.2)]"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Creating account…
                    </span>
                  ) : (
                    'Create free account'
                  )}
                </Button>
              </div>
              <LegalConsent />
            </form>
          ) : (
            <form onSubmit={isLogin ? handleSubmit : goToLanguageStep} className="flex flex-col gap-4">
              {!isLogin && (
                <div className="flex flex-col gap-2">
                  <label htmlFor="auth-name" className="text-xs font-semibold text-[#4a5565]">Full name</label>
                  <input
                    id="auth-name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Chen"
                    className="w-full h-11 px-3.5 bg-[#f9fafb] border border-[#e5e7eb] rounded-[14px] text-sm text-[#101828] placeholder:text-[#9ca3af] outline-none focus:ring-2 focus:ring-[#7f22fe]/20 focus:border-[#7f22fe] focus:bg-white transition-all"
                  />
                </div>
              )}
              <div className="flex flex-col gap-2">
                <label htmlFor="auth-email" className="text-xs font-semibold text-[#4a5565]">Email</label>
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
                  className="w-full h-11 px-3.5 bg-[#f9fafb] border border-[#e5e7eb] rounded-[14px] text-sm text-[#101828] placeholder:text-[#9ca3af] outline-none focus:ring-2 focus:ring-[#7f22fe]/20 focus:border-[#7f22fe] focus:bg-white transition-all"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="auth-password" className="text-xs font-semibold text-[#4a5565]">Password</label>
                <div className="relative">
                  <input
                    id="auth-password"
                    name="password"
                    type={showPass ? 'text' : 'password'}
                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={isLogin ? 'Your password' : 'At least 8 characters'}
                    className="w-full h-11 pl-3.5 pr-11 bg-[#f9fafb] border border-[#e5e7eb] rounded-[14px] text-sm text-[#101828] placeholder:text-[#9ca3af] outline-none focus:ring-2 focus:ring-[#7f22fe]/20 focus:border-[#7f22fe] focus:bg-white transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#9ca3af] hover:text-[#4a5565]"
                    aria-label={showPass ? 'Hide password' : 'Show password'}
                  >
                    {showPass ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                  </button>
                </div>
              </div>
              {isLogin && (
                <div className="flex items-center justify-end">
                  <Link
                    to={forgotPasswordTo}
                    className="text-[13px] font-semibold text-[#7f22fe] hover:text-[#6b1fd8]"
                  >
                    Forgot password?
                  </Link>
                </div>
              )}
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-[14px] bg-[#7f22fe] hover:bg-[#6b1fd8] font-bold text-sm shadow-[0_10px_12px_rgba(127,34,254,0.2)]"
              >
                {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {isLogin ? 'Signing in…' : 'Continuing…'}
                    </span>
                  ) : isLogin ? (
                    'Sign in'
                  ) : (
                    'Continue'
                  )}
              </Button>
              {!isLogin && <LegalConsent />}
            </form>
          )}

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-[#e5e7eb]" />
            <span className="text-xs text-[#9ca3af]">or</span>
            <div className="flex-1 h-px bg-[#e5e7eb]" />
          </div>

          <div className="flex items-center justify-between gap-3 text-[13px] whitespace-nowrap">
            <span className="text-[#6b7280]">
              {isLogin ? "Don't have an account?" : 'Already have an account?'}
            </span>
            <Link
              replace
              to={switchTo}
              state={{ email, name }}
              className="text-[#7f22fe] font-bold hover:text-[#6b1fd8]"
            >
              {isLogin ? 'Sign up free' : 'Sign in'}
            </Link>
          </div>
        </div>

        <button
          type="button"
          onClick={goHome}
          className="mt-5 flex items-center gap-1.5 text-sm font-medium text-[#99a1af] hover:text-[#4a5565] mx-auto"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to homepage
        </button>
      </div>
    </AuthShell>
  );
}
