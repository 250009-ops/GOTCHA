import { useEffect, useState, type ReactNode } from 'react';
import { useLearnerCopy } from '../lib/learnerLocaleContext';
import { LanguagePicker } from './LanguagePicker';
import { GotchaLogo } from './GotchaLogo';

const API_BASE = (import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:3000/api/v1' : '/api/v1')).replace(/\/$/, '');

export const AUTH_FEATURES = [
  { key: 'readRealContent' as const },
  { key: 'buildVocabulary' as const },
  { key: 'trackProgress' as const },
  { key: 'learnInContext' as const },
] as const;

type AuthMarketing = {
  learnerCount: number;
  languageNames: string[];
  readerInitials: string[];
};

/** Fired after email verification so the sidebar count can increment immediately. */
export const LEARNER_COUNT_CHANGED_EVENT = 'gotcha:learner-count-changed';

export function notifyLearnerCountChanged() {
  window.dispatchEvent(new Event(LEARNER_COUNT_CHANGED_EVENT));
}

function formatLanguageList(names: string[]): string | null {
  const unique = names.map((n) => n.trim()).filter(Boolean);
  if (unique.length === 0) return null;
  if (unique.length === 1) return unique[0];
  if (unique.length === 2) return `${unique[0]} & ${unique[1]}`;
  return `${unique.slice(0, -1).join(', ')} & ${unique[unique.length - 1]}`;
}

function useAuthMarketing(): AuthMarketing {
  const [data, setData] = useState<AuthMarketing>({
    learnerCount: 0,
    languageNames: [],
    readerInitials: [],
  });

  useEffect(() => {
    let cancelled = false;

    const load = () => {
      const statsP = fetch(`${API_BASE}/marketing/stats`, { cache: 'no-store' }).then((res) => {
        if (!res.ok) throw new Error(`stats ${res.status}`);
        return res.json() as Promise<{ learnerCount?: number }>;
      });
      const landingP = fetch(`${API_BASE}/marketing/landing`).then((res) => {
        if (!res.ok) throw new Error(`landing ${res.status}`);
        return res.json() as Promise<{
          stats?: { learnerCount?: number };
          languages?: Array<{ name?: string }>;
          topReaders?: Array<{ initials?: string }>;
        }>;
      });

      void Promise.allSettled([statsP, landingP]).then(([statsRes, landingRes]) => {
        if (cancelled) return;
        const stats = statsRes.status === 'fulfilled' ? statsRes.value : null;
        const landing = landingRes.status === 'fulfilled' ? landingRes.value : null;
        const initials = (landing?.topReaders ?? [])
          .map((r) => r.initials?.trim())
          .filter((v): v is string => Boolean(v))
          .slice(0, 4);
        setData((prev) => ({
          learnerCount:
            Number(stats?.learnerCount ?? landing?.stats?.learnerCount) || prev.learnerCount,
          languageNames: landing
            ? (landing.languages ?? []).map((l) => l.name ?? '').filter(Boolean)
            : prev.languageNames,
          readerInitials: landing ? initials : prev.readerInitials,
        }));
      });
    };

    load();
    window.addEventListener(LEARNER_COUNT_CHANGED_EVENT, load);
    return () => {
      cancelled = true;
      window.removeEventListener(LEARNER_COUNT_CHANGED_EVENT, load);
    };
  }, []);

  return data;
}

export function AuthBrandMark({ light }: { light?: boolean }) {
  return <GotchaLogo size={40} tone={light ? 'light' : 'ink'} />;
}

function MarketingPanel() {
  const copy = useLearnerCopy();
  const { learnerCount, languageNames, readerInitials } = useAuthMarketing();
  const languageLine = formatLanguageList(languageNames);

  return (
    <div className="hidden lg:flex flex-col w-[480px] shrink-0 relative overflow-hidden gap-6 px-10 pt-10 pb-8 bg-gradient-to-r from-g-blue-700 via-g-blue-900 via-[55%] to-g-blue-900">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-[120px] -top-[120px] size-[320px] rounded-full bg-white/[0.05] blur-[40px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-[260px] top-[420px] size-[260px] rounded-full bg-white/[0.05] blur-[40px]"
      />

      <div className="relative z-10 flex items-center shrink-0">
        <AuthBrandMark light />
      </div>

      <div className="relative z-10 flex-1 flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <h1 className="text-[36px] leading-[44px] font-extrabold text-white">
            {copy.auth.readYourWay}
            <br />
            <span className="font-bold">{copy.auth.readYourWayBold}</span>
          </h1>
          <p className="text-[16px] leading-6 text-g-blue-200">{copy.auth.authTagline}</p>
        </div>

        <div className="flex flex-col gap-3">
          {copy.auth.authFeatures.map((f, idx) => (
            <div
              key={f.title}
              className="flex items-center gap-3 rounded-[16px] border border-white/10 bg-white/[0.07] p-3.5"
            >
              <span className="block shrink-0 size-2.5 rounded-full bg-[#ff8904]" />
              <div className="flex-1 min-w-0">
                <div className="text-white font-bold text-sm leading-5">{f.title}</div>
                <div className="text-g-blue-200 text-[13px] leading-[18px]">
                  {idx === 0 && languageLine ? copy.auth.booksInLanguages(languageLine) : f.desc}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex-1" />

        {learnerCount > 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between whitespace-nowrap gap-3">
              <p className="text-white text-[13px] font-semibold">
                {copy.auth.learnersCount(learnerCount.toLocaleString('en-US'))}
              </p>
              <p className="text-g-blue-200 text-xs">{copy.auth.alreadyReading}</p>
            </div>
            {readerInitials.length > 0 && (
              <div className="flex items-center">
                {readerInitials.map((initials, idx) => (
                  <div
                    key={`${initials}-${idx}`}
                    className={`flex items-center justify-center size-8 rounded-2xl border-2 border-white bg-gradient-to-r from-g-blue-200 to-[#4f39f6] text-white text-[10px] font-extrabold ${
                      idx > 0 ? '-ml-2' : ''
                    }`}
                  >
                    {initials}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Split marketing + form shell used by login, register, and verify-email. */
export function AuthShell({ children }: { children: ReactNode }) {
  const copy = useLearnerCopy();

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#f9fafb] overflow-x-hidden">
      <div className="fixed top-4 right-4 z-[60] sm:top-6 sm:right-6">
        <LanguagePicker compact />
      </div>

      <MarketingPanel />

      <div className="lg:hidden flex flex-col gap-3 px-5 sm:px-6 pt-6 pb-5 bg-gradient-to-r from-g-blue-700 via-g-blue-900 via-[55%] to-g-blue-900">
        <AuthBrandMark light />
        <p className="text-g-blue-200 text-sm leading-5 pr-24">
          {copy.auth.readYourWay} {copy.auth.readYourWayBold}
        </p>
      </div>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-4 sm:p-6 min-w-0 bg-[#f9fafb]">
        {children}
      </div>
    </div>
  );
}
