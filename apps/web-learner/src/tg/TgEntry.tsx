import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth, type SessionResponse } from '../lib/auth';
import { useLearnerLocale } from '../lib/learnerLocaleContext';
import { markTelegramMode, setupWebApp, startParamRoute, telegramBotLink, waitForWebApp } from '../lib/telegram';
import { tgCopyFor } from './tgCopy';

type SessionResult = SessionResponse | { needsSignup: true; prefill: { fullName: string }; phone: string | null };

/** `/tg` — Mini App launch: Telegram session → app, or → sign-up when this Telegram account is new. */
export default function TgEntry() {
  const navigate = useNavigate();
  const { adoptSession } = useAuth();
  const { locale } = useLearnerLocale();
  const t = tgCopyFor(locale);
  const [state, setState] = useState<'loading' | 'outside' | 'error'>('loading');

  const start = useCallback(async () => {
    setState('loading');
    const w = await waitForWebApp();
    if (!w || !w.initData) {
      setState('outside');
      return;
    }
    markTelegramMode();
    setupWebApp(w);
    try {
      const res = await api<SessionResult>('/auth/telegram/session', {
        method: 'POST',
        body: JSON.stringify({ initData: w.initData }),
      });
      if ('accessToken' in res) {
        await adoptSession(res);
        // Deep link: Telegram's start_param (t.me/<bot>/<app>?startapp=…) or ?startapp=… on a web_app button URL.
        const deep = w.initDataUnsafe?.start_param ?? new URLSearchParams(window.location.search).get('startapp');
        navigate(startParamRoute(deep), { replace: true });
        return;
      }
      navigate('/tg/signup', { replace: true, state: { fullName: res.prefill?.fullName ?? '', phone: res.phone } });
    } catch {
      setState('error');
    }
  }, [adoptSession, navigate]);

  useEffect(() => {
    void start();
  }, [start]);

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-4 bg-[#f6f7fb] px-6 text-center font-sans">
      <span className="size-14 rounded-2xl bg-g-blue-700 text-white grid place-items-center text-2xl font-extrabold">G</span>
      {state === 'loading' && (
        <p className="flex items-center gap-2 text-sm text-[#6b7080]">
          <Loader2 className="w-4 h-4 animate-spin" />
          {t.loading}
        </p>
      )}
      {state === 'outside' && (
        <>
          <h1 className="text-xl font-extrabold text-[#101828]">{t.outsideTitle}</h1>
          <p className="max-w-[320px] text-sm text-[#6b7080]">{t.outsideBody}</p>
          <a href={telegramBotLink()} className="h-12 px-6 rounded-xl bg-g-blue-700 text-white font-bold inline-flex items-center">
            {t.openBot}
          </a>
        </>
      )}
      {state === 'error' && (
        <>
          <p className="text-sm text-[#b91c1c]">{t.sessionError}</p>
          <button type="button" onClick={() => void start()} className="h-12 px-6 rounded-xl bg-g-blue-700 text-white font-bold">
            {t.retry}
          </button>
        </>
      )}
    </div>
  );
}
