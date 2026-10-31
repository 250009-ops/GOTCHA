// Screen 16-limit-hit (PAYMENTS.md §14, final): Defaults #4 message + reset time in the user's timezone.
// Mounted once; listens for the 429 limit event from lib/api.ts. Never an error toast.
// "Get Plus" only for Free lookups and only while Plus is sold on the web (WEB_PLUS_PASS → offer.enabled).
import { useEffect, useState } from 'react';
import { Clock, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { payCopyFor } from '@gotcha/shared';
import { DAILY_LIMIT_EVENT, dailyLimitText, limitTitle, type DailyLimitInfo } from '../lib/dailyLimit';
import { useLearnerLocale } from '../lib/learnerLocaleContext';
import { api } from '../lib/api';

export function DailyLimitNotice() {
  const { locale } = useLearnerLocale();
  const navigate = useNavigate();
  const [info, setInfo] = useState<DailyLimitInfo | null>(null);
  const [plusSold, setPlusSold] = useState(false);
  useEffect(() => {
    const on = (e: Event) => setInfo((e as CustomEvent<DailyLimitInfo>).detail);
    window.addEventListener(DAILY_LIMIT_EVENT, on);
    return () => window.removeEventListener(DAILY_LIMIT_EVENT, on);
  }, []);
  const txt = info ? dailyLimitText(info, locale) : null;
  useEffect(() => {
    if (!txt?.upsell) return;
    api<{ enabled?: boolean; active?: boolean }>('/billing/plus/offer').then((o) => setPlusSold(!!o.enabled && !o.active)).catch(() => setPlusSold(false));
  }, [txt?.upsell]);
  if (!info || !txt) return null;
  return (
    <div role="status" aria-live="polite" data-testid="daily-limit-notice" data-kind={info.kind} data-plan={info.plan}
      className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-[14px] border-2 p-4 shadow-lg"
      style={{ background: 'var(--g-card)', borderColor: '#C98A00', color: 'var(--g-text)' }}>
      <div className="flex gap-3">
        <Clock className="w-5 h-5 mt-0.5 shrink-0" style={{ color: '#C98A00' }} aria-hidden />
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-xs font-bold uppercase" style={{ color: 'var(--g-text-3)' }}>{limitTitle(locale)}</p>
          <p className="text-sm font-bold">{txt.message}</p>
          <p className="text-xs" style={{ color: 'var(--g-text-2)' }} data-testid="daily-limit-reset">{txt.reset}</p>
          {txt.upsell && plusSold && (
            <button type="button" data-testid="daily-limit-plus" onClick={() => { setInfo(null); navigate('/app/plus'); }}
              className="mt-1 min-h-[36px] rounded-[12px] px-3 text-sm font-bold text-[var(--g-on-cta)]" style={{ background: 'var(--g-cta)' }}>
              {payCopyFor(locale)['plus.cta']}
            </button>
          )}
        </div>
        <button type="button" aria-label="×" onClick={() => setInfo(null)} className="min-h-[32px] self-start"><X className="w-4 h-4" /></button>
      </div>
    </div>
  );
}
