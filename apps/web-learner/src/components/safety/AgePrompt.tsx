import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useLearnerLocale } from '../../lib/learnerLocaleContext';
import { rememberAgePromptDismissed, shouldShowAgePrompt } from '../../lib/agePromptPolicy';
import { AGE_COPY, birthYearOptions, toConsentLocale } from './signupConsent';

const CLOSE = { uz: 'Yopish', ru: 'Закрыть', en: 'Close' } as const;
const store = (): Storage | null => { try { return window.localStorage; } catch { return null; } };

/**
 * W-12: one-time birth-year prompt for existing users (server sets needsAgePrompt).
 * S3b (final-6.1): a small dismissible card, NOT a modal: it never blocks Library, Import or Vocabulary,
 * and once dismissed (✕ / Esc / prefer not to say) it is not shown again on this device.
 */
export function AgePrompt() {
  const { user, refreshProfile } = useAuth();
  const { locale } = useLearnerLocale();
  const [year, setYear] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const u = user as { id?: string; needsAgePrompt?: boolean } | null;
  const show = !done && shouldShowAgePrompt(u, store());
  const dismiss = () => { rememberAgePromptDismissed(u?.id, store()); setDone(true); };
  useEffect(() => {
    if (!show) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') dismiss(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  if (!show) return null;
  const lc = toConsentLocale(locale);
  const c = AGE_COPY[lc];
  const send = async (birthYear: number | null) => {
    setBusy(true);
    try {
      await api('/users/me/age', { method: 'POST', body: JSON.stringify({ birthYear }) });
      dismiss();
      await refreshProfile().catch(() => undefined);
    } catch {
      dismiss(); // never trap the learner behind a failed save
    } finally {
      setBusy(false);
    }
  };
  return (
    <div role="dialog" aria-modal="false" aria-labelledby="age-prompt-title" data-testid="age-prompt"
      className="relative z-10 mx-3 mt-3 md:fixed md:bottom-4 md:right-4 md:left-auto md:mx-0 md:mt-0 md:z-[60] md:w-[22rem] pointer-events-none">
      <div className="pointer-events-auto rounded-2xl bg-white p-4 shadow-xl border border-[#e5e7eb] flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <h2 id="age-prompt-title" className="text-base font-bold text-[#101828]">{c.promptTitle}</h2>
          <button type="button" aria-label={CLOSE[lc]} onClick={dismiss} className="-m-1 h-8 w-8 rounded-full text-[#4a5565] hover:bg-[#f3f4f6]">✕</button>
        </div>
        <p className="text-sm text-[#4a5565]">{c.promptBody}</p>
        <select aria-label={c.promptTitle} value={year ?? ''} onChange={(e) => setYear(e.target.value ? Number(e.target.value) : null)}
          className="h-11 rounded-[14px] border border-[#e5e7eb] bg-[#f9fafb] px-3 text-sm text-[#101828]">
          <option value="">—</option>
          {birthYearOptions().map((y) => (<option key={y} value={y}>{y}</option>))}
        </select>
        <div className="flex gap-2">
          <button type="button" disabled={busy} onClick={() => void send(null)} className="flex-1 h-11 rounded-[14px] border border-[#e5e7eb] text-sm font-medium text-[#101828]">{c.skip}</button>
          <button type="button" disabled={busy || year == null} onClick={() => void send(year)} className="flex-1 h-11 rounded-[14px] bg-[#7f22fe] text-white text-sm font-bold disabled:opacity-50">{c.save}</button>
        </div>
      </div>
    </div>
  );
}
