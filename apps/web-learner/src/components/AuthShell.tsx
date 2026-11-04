import { useEffect, useState, type ReactNode } from 'react';
import { ArrowLeft, Check, ShieldCheck } from 'lucide-react';
import { useLearnerCopy, useLearnerLocale } from '../lib/learnerLocaleContext';
import { MARKETING_URL } from '../lib/links';
import { LanguagePicker } from './LanguagePicker';
import { BrandMark, GotchaLogo } from './GotchaLogo';

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
      // WLF-35 (final-6.1a): /marketing/landing is retired (410); the login panel reads /marketing/stats only.
      void statsP.then(
        (stats) => {
          if (cancelled) return;
          setData((prev) => ({ ...prev, learnerCount: Number(stats?.learnerCount) || prev.learnerCount }));
        },
        () => undefined,
      );
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

/** Navy mark on a white tile so the logo stays visible on the blue auth panel. */
export function AuthBrandMark({ light }: { light?: boolean }) {
  const size = 36;
  const wordmark = `${import.meta.env.BASE_URL ?? '/'}brand/gotcha-wordmark-${light ? 'dark' : 'light'}.svg`;
  return (
    <span className="inline-flex items-center" style={{ gap: Math.round(size * 0.375) }}>
      <span className="inline-flex rounded-[14px] bg-white p-1 shadow-[0_8px_18px_rgba(0,0,0,0.18)]">
        <BrandMark size={size} elevated={false} />
      </span>
      <img
        src={wordmark}
        alt="GOTCHA"
        draggable={false}
        className="select-none block"
        style={{ height: size * 0.5625, width: 'auto' }}
      />
    </span>
  );
}

/** Panel strings not in the shared copy yet (uz / ru / en). */
const AX = {
  en: { previewKicker: 'Tap any word', previewMeaning: 'quietly, without noise', home: 'Homepage', secure: 'Your data is encrypted and never sold.' },
  ru: { previewKicker: 'Нажмите на любое слово', previewMeaning: 'тихо, бесшумно', home: 'На главную', secure: 'Данные шифруются и никому не продаются.' },
  uz: { previewKicker: 'Istalgan soʻzga bosing', previewMeaning: 'jimgina, shovqinsiz', home: 'Bosh sahifa', secure: 'Maʼlumotlaringiz shifrlanadi va hech kimga sotilmaydi.' },
};

function MarketingPanel() {
  const copy = useLearnerCopy();
  const { locale } = useLearnerLocale();
  const ax = AX[locale === 'ru' || locale === 'uz' ? locale : 'en'];
  const { learnerCount, languageNames, readerInitials } = useAuthMarketing();
  const languageLine = formatLanguageList(languageNames);

  return (
    <div className="hidden lg:flex flex-col w-[46%] max-w-[600px] min-w-[460px] shrink-0 relative overflow-hidden px-12 pt-10 pb-10 bg-[#0b0c26] text-white">
      <div aria-hidden className="pointer-events-none absolute -right-40 -top-40 size-[520px] rounded-full bg-g-blue-700/50 blur-[90px]" />
      <div aria-hidden className="pointer-events-none absolute -left-24 bottom-0 size-[360px] rounded-full bg-[#4f39f6]/25 blur-[90px]" />

      <div className="relative z-10 flex items-center shrink-0">
        <AuthBrandMark light />
      </div>

      <div className="relative z-10 flex-1 flex flex-col justify-center gap-8 py-10 max-w-[460px]">
        <div className="flex flex-col gap-3">
          <h1 className="text-[40px] leading-[1.1] font-extrabold tracking-tight">
            {copy.auth.readYourWay}{' '}
            <span className="text-[#a5b4fc]">{copy.auth.readYourWayBold}</span>
          </h1>
          <p className="text-base leading-6 text-white/70">{copy.auth.authTagline}</p>
        </div>

        {/* Product preview: what a tap on a word does. */}
        <div className="rounded-2xl bg-white/[0.06] border border-white/10 p-5 backdrop-blur-sm" aria-hidden>
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#a5b4fc] mb-3">{ax.previewKicker}</div>
          <p className="font-serif text-[19px] leading-8 text-white/90">
            The old house stood{' '}
            <span className="relative rounded-md bg-[#fde68a] px-1 text-[#101828]">
              quietly
              <span className="absolute left-1/2 top-full mt-2.5 -translate-x-1/2 whitespace-nowrap rounded-xl bg-white px-3 py-2 text-left shadow-[0_14px_30px_rgba(0,0,0,.35)]">
                <span className="block font-sans text-[13px] font-bold text-[#101828] leading-4">quietly</span>
                <span className="block font-sans text-xs text-[#4a5565] leading-4 mt-0.5">{ax.previewMeaning}</span>
              </span>
            </span>{' '}
            by the river.
          </p>
          <div className="h-11" />
        </div>

        <ul className="grid grid-cols-2 gap-x-5 gap-y-4">
          {copy.auth.authFeatures.map((f, idx) => (
            <li key={f.title} className="flex gap-2.5 min-w-0">
              <span className="mt-0.5 size-5 shrink-0 rounded-full bg-white/10 grid place-items-center">
                <Check className="w-3 h-3 text-[#a5b4fc]" strokeWidth={3} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-5">{f.title}</span>
                <span className="block text-[13px] leading-[18px] text-white/60">
                  {idx === 0 && languageLine ? copy.auth.booksInLanguages(languageLine) : f.desc}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="relative z-10 flex items-center justify-between gap-4 text-[13px]">
        {learnerCount > 0 ? (
          <div className="flex items-center gap-3">
            {readerInitials.length > 0 && (
              <div className="flex items-center">
                {readerInitials.map((initials, idx) => (
                  <div
                    key={`${initials}-${idx}`}
                    className={`flex items-center justify-center size-8 rounded-full border-2 border-[#0b0c26] bg-gradient-to-r from-g-blue-200 to-[#4f39f6] text-white text-[10px] font-extrabold ${idx > 0 ? '-ml-2' : ''}`}
                  >
                    {initials}
                  </div>
                ))}
              </div>
            )}
            <span>
              <b className="font-semibold">{copy.auth.learnersCount(learnerCount.toLocaleString('en-US'))}</b>{' '}
              <span className="text-white/60">{copy.auth.alreadyReading}</span>
            </span>
          </div>
        ) : <span />}
        <span className="inline-flex items-center gap-1.5 text-white/50 text-xs">
          <ShieldCheck className="w-3.5 h-3.5" />
          {ax.secure}
        </span>
      </div>
    </div>
  );
}

/** Split marketing + form shell used by login, register, verify-email and password reset. */
export function AuthShell({ children }: { children: ReactNode }) {
  const copy = useLearnerCopy();
  const { locale } = useLearnerLocale();
  const ax = AX[locale === 'ru' || locale === 'uz' ? locale : 'en'];

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#f6f7fb] overflow-x-hidden">
      <MarketingPanel />

      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between gap-4 px-4 sm:px-8 h-16 shrink-0">
          <a
            href={MARKETING_URL}
            className="inline-flex items-center gap-1.5 min-h-10 rounded-lg text-sm font-medium text-[#4a5565] hover:text-[#101828] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2107AA]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="lg:hidden"><AuthBrandMarkSmall /></span>
            <span className="hidden lg:inline">{ax.home}</span>
          </a>
          <LanguagePicker compact />
        </div>

        <div className="lg:hidden px-5 sm:px-8 mt-2 mb-1 text-center">
          <h1 className="text-[22px] leading-7 font-extrabold tracking-tight text-[#101828]">
            {copy.auth.readYourWay} <span className="text-g-blue-700">{copy.auth.readYourWayBold}</span>
          </h1>
        </div>

        <div className="relative z-10 flex-1 flex flex-col items-center justify-start lg:justify-center px-4 sm:px-6 pb-10 pt-4 lg:pt-2 min-w-0">
          {children}
        </div>
      </div>
    </div>
  );
}

function AuthBrandMarkSmall() {
  return <GotchaLogo size={26} tone="ink" />;
}
