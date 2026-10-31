import { useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useLearnerLocale } from '../../lib/learnerLocaleContext';
import { AGE_COPY, birthYearOptions, toConsentLocale } from './signupConsent';

/** W-12: one-time birth-year prompt for existing users (server sets needsAgePrompt). */
export function AgePrompt() {
  const { user, refreshProfile } = useAuth();
  const { locale } = useLearnerLocale();
  const [year, setYear] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const needs = (user as { needsAgePrompt?: boolean } | null)?.needsAgePrompt;
  if (!needs || done) return null;
  const c = AGE_COPY[toConsentLocale(locale)];
  const send = async (birthYear: number | null) => {
    setBusy(true);
    try {
      await api('/users/me/age', { method: 'POST', body: JSON.stringify({ birthYear }) });
      setDone(true);
      await refreshProfile().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="age-prompt-title" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl flex flex-col gap-3">
        <h2 id="age-prompt-title" className="text-base font-bold text-[#101828]">{c.promptTitle}</h2>
        <p className="text-sm text-[#4a5565]">{c.promptBody}</p>
        <select
          aria-label={c.promptTitle}
          value={year ?? ''}
          onChange={(e) => setYear(e.target.value ? Number(e.target.value) : null)}
          className="h-11 rounded-[14px] border border-[#e5e7eb] bg-[#f9fafb] px-3 text-sm"
        >
          <option value="">—</option>
          {birthYearOptions().map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <button type="button" disabled={busy} onClick={() => void send(null)} className="flex-1 h-11 rounded-[14px] border border-[#e5e7eb] text-sm font-medium">
            {c.skip}
          </button>
          <button type="button" disabled={busy || year == null} onClick={() => void send(year)} className="flex-1 h-11 rounded-[14px] bg-[#7f22fe] text-white text-sm font-bold disabled:opacity-50">
            {c.save}
          </button>
        </div>
      </div>
    </div>
  );
}
