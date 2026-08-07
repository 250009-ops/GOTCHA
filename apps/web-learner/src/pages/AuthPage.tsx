import { useState } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { useAuth } from '../lib/auth';
import { clearTokens } from '../lib/api';
import { isAllowedAdminReturnUrl, MARKETING_URL } from '../lib/links';
import { AuthIcon, authAssets as a } from '../assets/auth';

const FEATURES = [
  {
    title: 'Read real content',
    desc: 'Books, articles, and news across supported languages',
  },
  {
    title: 'Build vocabulary',
    desc: 'AI-powered word lookup with spaced repetition',
  },
  {
    title: 'Track your progress',
    desc: 'CEFR level tracking, streaks, and reading stats',
  },
  {
    title: 'Learn in context',
    desc: 'Words stick when you learn them from real sentences',
  },
] as const;

function BrandMark({ light }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="flex items-center justify-center bg-[#2107aa] rounded-[12px]"
        style={{ width: 40, height: 40 }}
      >
        <span
          className="text-white text-2xl leading-none"
          style={{ fontFamily: 'Bagel Fat One, cursive' }}
        >
          G
        </span>
      </div>
      <span
        className={`text-[20px] leading-7 tracking-[-0.5px] ${light ? 'text-white' : 'text-[#101828]'}`}
        style={{ fontFamily: 'Bagel Fat One, cursive' }}
      >
        GOTCHA
      </span>
    </div>
  );
}

export default function AuthPage() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const { login, register } = useAuth();
  const isLogin = pathname === '/login';
  const plan = searchParams.get('plan');
  const fromLanding = searchParams.get('from') === 'landing';
  const adminReturnUrl = isAllowedAdminReturnUrl(searchParams.get('returnUrl'));

  const [email, setEmail] = useState(isLogin ? (adminReturnUrl ? 'admin@gotcha.app' : 'learner@gotcha.app') : '');
  const [password, setPassword] = useState(isLogin ? (adminReturnUrl ? 'GotchaAdmin2026!' : 'Learner2026!') : '');
  const [name, setName] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      if (isLogin) {
        const session = await login(email, password);
        if (adminReturnUrl) {
          if (!session.isAdmin) {
            toast.error('This account does not have admin access');
            navigate('/app');
            return;
          }
          // Leave tokens only for the admin app (hash handoff); avoid a lingering learner session.
          clearTokens();
          const handoff = new URL(adminReturnUrl);
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
        navigate('/app');
      } else {
        await register({
          email,
          password,
          displayName: name || undefined,
          nativeLanguage: 'en',
          targetLanguages: ['ru'],
        });
        toast.success('Account created!');
        navigate('/app');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const goHome = () => {
    window.location.assign(MARKETING_URL);
  };

  const switchMode = () => {
    const next = isLogin ? '/register' : '/login';
    const q = searchParams.toString();
    navigate(q ? `${next}?${q}` : next);
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#f9fafb] overflow-x-hidden">
      {/* Desktop marketing panel */}
      <div className="hidden lg:flex flex-col w-[480px] shrink-0 relative overflow-hidden gap-6 px-10 pt-10 pb-8 bg-gradient-to-r from-[#7008e7] via-[#372aac] via-[55%] to-[#4d179a]">
        <div className="absolute -left-[120px] -top-[120px] size-[320px] pointer-events-none">
          <div className="absolute -inset-[25%]">
            <img src={a.bgGlow1} alt="" className="block size-full max-w-none" />
          </div>
        </div>
        <div className="absolute left-[260px] top-[420px] size-[260px] pointer-events-none">
          <div className="absolute -inset-[27%]">
            <img src={a.bgGlow2} alt="" className="block size-full max-w-none" />
          </div>
        </div>

        <div className="relative">
          <BrandMark light />
        </div>

        <div className="relative flex-1 flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <h1 className="text-[36px] leading-[44px] font-extrabold text-white">
              Read your way
              <br />
              <span className="font-bold">to fluency.</span>
            </h1>
            <p className="text-[16px] leading-6 text-[#ddd6ff]">
              The reading-first language app that makes every page a lesson.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="flex items-center gap-3 rounded-[16px] border border-white/10 bg-white/[0.07] p-3.5"
              >
                <span className="block shrink-0 size-2.5 rounded-full bg-white" />
                <div className="flex-1 min-w-0">
                  <div className="text-white font-bold text-sm leading-5">{f.title}</div>
                  <div className="text-[#c4b4ff] text-[13px] leading-[18px]">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex-1" />

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between whitespace-nowrap">
              <p className="text-white text-[13px] font-semibold">12,840 learners</p>
              <p className="text-[#c4b4ff] text-xs">actively reading this week</p>
            </div>
            <div className="flex items-center gap-2">
              {['AC', 'JD', 'MR', 'SK'].map((i) => (
                <div
                  key={i}
                  className="flex items-center justify-center size-8 rounded-2xl border border-white/10 bg-gradient-to-r from-[#a684ff] to-[#4f39f6] text-white text-[10px] font-extrabold"
                >
                  {i}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Narrow-web branded header */}
      <div className="lg:hidden flex flex-col gap-3 px-5 sm:px-6 pt-6 pb-5 bg-gradient-to-r from-[#7008e7] via-[#372aac] via-[55%] to-[#4d179a]">
        <BrandMark light />
        <p className="text-[#ddd6ff] text-sm leading-5">Read your way to fluency.</p>
      </div>

      {/* Form area */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 min-w-0">
        <div className="w-full max-w-[448px] min-w-0">
          <div className="bg-white border-[0.8px] border-[#e5e7eb] rounded-2xl p-5 sm:p-8 flex flex-col gap-5 shadow-[0_18px_20px_rgba(0,0,0,0.08),0_2px_4px_rgba(0,0,0,0.06)]">
            <div className="flex flex-col gap-1.5">
              <h2 className="text-2xl font-extrabold text-[#101828] leading-8">
                {isLogin ? 'Welcome back' : 'Create your account'}
              </h2>
              <p className="text-[#6b7280] text-sm leading-5">
                {isLogin
                  ? 'Sign in to continue your reading journey.'
                  : plan === 'premium'
                    ? 'Create your account to start the Premium free trial.'
                    : 'Sign up to start your reading journey.'}
              </p>
              {!isLogin && plan === 'premium' && (
                <div className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-[#f3f0ff] border border-[#ddd6fe] px-3 py-1 text-xs font-semibold text-[#7f22fe] self-start">
                  <AuthIcon src={a.sparkles} size={16} />
                  Premium trial · $9/mo after
                </div>
              )}
              {!isLogin && fromLanding && plan !== 'premium' && (
                <div className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700 self-start">
                  <AuthIcon src={a.check} size={16} />
                  Free forever plan
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {!isLogin && (
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-[#4a5565]">Full name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Chen"
                    className="w-full h-11 px-3.5 bg-[#f9fafb] border border-[#e5e7eb] rounded-[14px] text-sm text-[#101828] placeholder:text-[#9ca3af] outline-none focus:ring-2 focus:ring-[#7f22fe]/20 focus:border-[#7f22fe] focus:bg-white transition-all"
                  />
                </div>
              )}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-[#4a5565]">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full h-11 px-3.5 bg-[#f9fafb] border border-[#e5e7eb] rounded-[14px] text-sm text-[#101828] placeholder:text-[#9ca3af] outline-none focus:ring-2 focus:ring-[#7f22fe]/20 focus:border-[#7f22fe] focus:bg-white transition-all"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-[#4a5565]">Password</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
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
                  <button
                    type="button"
                    className="text-[13px] font-semibold text-[#7f22fe] hover:text-[#6b1fd8]"
                  >
                    Forgot password?
                  </button>
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
                    {isLogin ? 'Signing in…' : 'Creating account…'}
                  </span>
                ) : (
                  isLogin ? 'Sign in' : 'Create free account'
                )}
              </Button>
            </form>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-[#e5e7eb]" />
              <span className="text-xs text-[#9ca3af]">or</span>
              <div className="flex-1 h-px bg-[#e5e7eb]" />
            </div>

            <div className="flex items-center justify-between text-[13px] whitespace-nowrap">
              <span className="text-[#6b7280]">
                {isLogin ? "Don't have an account? " : 'Already have an account? '}
              </span>
              <button
                type="button"
                onClick={switchMode}
                className="text-[#7f22fe] font-bold hover:text-[#6b1fd8]"
              >
                {isLogin ? 'Sign up free' : 'Sign in'}
              </button>
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
      </div>
    </div>
  );
}
