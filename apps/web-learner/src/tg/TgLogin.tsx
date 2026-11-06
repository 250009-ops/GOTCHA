import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, Lock, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useAuth, type SessionResponse } from '../lib/auth';
import { useLearnerLocale } from '../lib/learnerLocaleContext';
import { haptic, markTelegramMode, setupWebApp, tgInitData, waitForWebApp } from '../lib/telegram';
import { tgCopyFor } from './tgCopy';

const inputCls =
  'w-full h-12 pl-11 pr-3.5 bg-white border border-[#dfe2ec] rounded-xl text-[15px] text-[#101828] placeholder:text-[#9aa0ae] focus-visible:outline-none focus-visible:border-[#2107AA] focus-visible:ring-4 focus-visible:ring-[#2107AA]/10';

/** `/tg/login` — screen 04: an existing gotchaa.uz account signs in once and links this Telegram account. */
export default function TgLogin() {
  const navigate = useNavigate();
  const { adoptSession } = useAuth();
  const { locale } = useLearnerLocale();
  const t = tgCopyFor(locale);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void waitForWebApp().then((w) => {
      if (!w?.initData) return;
      markTelegramMode();
      setupWebApp(w);
    });
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) return;
    setBusy(true);
    try {
      const res = await api<SessionResponse>('/auth/telegram/link', {
        method: 'POST',
        body: JSON.stringify({ initData: tgInitData(), identifier: identifier.trim(), password }),
      });
      await adoptSession(res);
      haptic('success');
      navigate('/app', { replace: true });
    } catch (err) {
      const e2 = err as Error & { status?: number };
      haptic('error');
      toast.error(e2.status === 409 ? t.linkedOther : e2.message || t.sessionError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#f6f7fb] font-sans text-[#101828]">
      <form onSubmit={submit} className="mx-auto max-w-[480px] px-[18px] pt-7 pb-8 flex flex-col gap-[18px]">
        <span className="size-12 rounded-[14px] bg-g-blue-700 text-white grid place-items-center text-[22px] font-extrabold">G</span>
        <div>
          <h1 className="text-[25px] leading-tight font-extrabold tracking-tight">{t.welcome}</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-[#6b7080]">{t.welcomeSub}</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="tg-id" className="text-[13.5px] font-semibold text-[#4a5565]">{t.identifier}</label>
          <div className="relative">
            <UserRound className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#8a8fa0]" />
            <input id="tg-id" autoComplete="username" autoCapitalize="none" spellCheck={false} value={identifier} onChange={(e) => setIdentifier(e.target.value)} className={inputCls} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <label htmlFor="tg-pw" className="text-[13.5px] font-semibold text-[#4a5565]">{t.password}</label>
            <Link to="/forgot-password" className="text-[13px] font-semibold text-g-blue-700">{t.forgot}</Link>
          </div>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#8a8fa0]" />
            <input id="tg-pw" type={showPw ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={`${inputCls} !pr-12`} />
            <button type="button" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? t.hidePw : t.showPw} className="absolute right-1 top-1/2 -translate-y-1/2 size-11 grid place-items-center text-[#8a8fa0]">
              {showPw ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
            </button>
          </div>
        </div>
        <p className="rounded-xl border border-[#e6e8f0] bg-white px-3.5 py-3 text-[13px] leading-relaxed text-[#4a5565]">{t.keepNote}</p>
        <button type="submit" disabled={busy || !identifier.trim() || !password} className="h-[50px] rounded-xl bg-g-blue-700 hover:bg-g-blue-800 text-white font-bold text-[15.5px] disabled:opacity-50 inline-flex items-center justify-center gap-2">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          {t.signIn}
        </button>
        <p className="text-center text-sm">
          <span className="text-[#6b7080]">{t.noAccount}</span>{' '}
          <Link to="/tg/signup" className="font-bold text-g-blue-700">{t.signUp}</Link>
        </p>
      </form>
    </div>
  );
}
