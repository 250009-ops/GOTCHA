import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CEFR_LEVELS, languageUiName, type CefrLevel } from '@gotcha/shared';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useCatalogLanguages } from '../../lib/catalogLanguages';
import { useLearnerLocale } from '../../lib/learnerLocaleContext';
import {
  isOnboardingDone,
  markOnboardingDone,
  ONBOARDING_STEPS,
  readOnboardingStep,
  writeOnboardingStep,
  type OnboardingStep,
} from '../../lib/onboarding';
import { onboardingCopy } from './copy';

const SENTENCE = ['He', 'stood', 'still', 'in', 'hesitation', 'at', 'the', 'door.'];

const selectClass =
  'mt-2 h-12 w-full rounded-2xl border border-[#E7E2D8] bg-white px-4 text-sm font-semibold text-[#14112B] outline-none focus:ring-2 focus:ring-[#2107AA]/30';

/** Prefer the chosen level, then the nearest easier level, then the nearest harder one. */
function bookLevels(selected: CefrLevel): CefrLevel[] {
  const i = Math.max(0, CEFR_LEVELS.indexOf(selected));
  const out: CefrLevel[] = [CEFR_LEVELS[i]];
  for (let d = 1; d < CEFR_LEVELS.length && out.length < 3; d++) {
    if (i - d >= 0) out.push(CEFR_LEVELS[i - d]);
    if (out.length < 3 && i + d < CEFR_LEVELS.length) out.push(CEFR_LEVELS[i + d]);
  }
  return out;
}

export function Onboarding({ onStep }: { onStep?: (step: OnboardingStep | 'done') => void }) {
  const navigate = useNavigate();
  const { user, preferences, refreshProfile } = useAuth();
  const { locale } = useLearnerLocale();
  const { langs } = useCatalogLanguages();
  const copy = onboardingCopy(locale);
  const [step, setStep] = useState<OnboardingStep | 'done'>(() => (isOnboardingDone() ? 'done' : readOnboardingStep()));
  const [book, setBook] = useState<{ id: string; title: string; author: string } | null>(null);
  const languageSeeded = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [level, setLevel] = useState<CefrLevel>('a2');
  const [language, setLanguage] = useState('en');
  const [tapped, setTapped] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    onStep?.(step);
  }, [onStep, step]);

  useEffect(() => {
    if (preferences?.onboardingDone) {
      markOnboardingDone();
      setStep('done');
    }
  }, [preferences?.onboardingDone]);

  useEffect(() => {
    const lang = language || 'en';
    const wanted = bookLevels(level);
    setBook(null);
    let cancel = false;
    type Row = { id: string; title: string; author?: string | null; wordCount?: number | null; cefrLevel?: string | null };
    Promise.all(wanted.map((cefr) =>
      api<{ items?: Row[] }>(`/content?lang=${encodeURIComponent(lang)}&level=${cefr}&page=1&pageSize=40`)
        .then((page) => page.items ?? [])
        .catch(() => [] as Row[]),
    )).then((groups) => {
      if (cancel) return;
      for (const items of groups) {
        const short = items
          .filter((item) => item.id && item.title && (item.wordCount ?? 0) >= 80 && (item.wordCount ?? 1_000_000) < 8_000)
          .sort((a, b) => (a.wordCount ?? 0) - (b.wordCount ?? 0))[0];
        if (short) {
          setBook({ id: short.id, title: short.title, author: short.author || '' });
          return;
        }
      }
    }).catch(() => undefined);
    return () => { cancel = true; };
  }, [language, level]);

  useEffect(() => {
    if (step === 'done') return;
    const root = dialogRef.current;
    if (!root) return;
    const focusable = () => Array.from(root.querySelectorAll<HTMLElement>('button, [href], input, select, textarea'))
      .filter((el) => !el.hasAttribute('disabled'));
    focusable()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    root.addEventListener('keydown', onKey);
    return () => root.removeEventListener('keydown', onKey);
  }, [step]);

  useEffect(() => {
    if (languageSeeded.current) return;
    const primary = user?.targetLanguages?.find((t) => t.isPrimary) ?? user?.targetLanguages?.[0];
    if (primary?.targetLanguage) {
      languageSeeded.current = true;
      setLanguage(primary.targetLanguage);
      if (primary.cefrLevel) setLevel(primary.cefrLevel);
      return;
    }
    const native = user?.nativeLanguage;
    const first = langs.find((l) => l.code !== native)?.code;
    if (first) {
      languageSeeded.current = true;
      setLanguage(first);
    }
  }, [langs, user]);

  if (step === 'done') return null;

  const index = ONBOARDING_STEPS.indexOf(step);
  const go = (next: OnboardingStep | 'done') => {
    if (next === 'done') {
      markOnboardingDone();
      setStep('done');
      void api('/users/me/preferences', { method: 'PATCH', body: JSON.stringify({ onboardingDone: true }) }).catch(() => undefined);
      return;
    }
    writeOnboardingStep(next);
    setStep(next);
  };

  const saveLevel = async () => {
    setBusy(true);
    try {
      const existing = user?.targetLanguages?.find((t) => t.targetLanguage === language);
      if (existing) {
        await api(`/users/me/target-languages/${language}`, {
          method: 'PATCH',
          body: JSON.stringify({ cefrLevel: level, isPrimary: true }),
        });
      } else {
        await api('/users/me/target-languages', {
          method: 'POST',
          body: JSON.stringify({ targetLanguage: language, cefrLevel: level, isPrimary: true }),
        });
      }
      await refreshProfile().catch(() => undefined);
    } catch {
      /* The tour still continues if the save fails. */
    } finally {
      setBusy(false);
      go('demo');
    }
  };

  const openBook = () => {
    writeOnboardingStep('practice');
    setStep('practice');
    if (book) navigate(`/app/read/${book.id}`);
    else navigate('/app');
  };

  const practice = step === 'practice';

  return (
    <div className="fixed inset-0 z-40" data-testid="onboarding" data-onboarding-step={step}>
      <div className="absolute inset-0 bg-[#14112B]/55" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        className={`absolute bg-[#FFFcf8] border border-[#E7E2D8] shadow-[0_28px_80px_rgba(20,17,43,0.32)] ${
          practice
            ? 'left-3 right-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] rounded-[28px] sm:left-[16rem] sm:right-auto sm:bottom-auto sm:top-36 sm:w-[22.5rem]'
            : 'left-1/2 top-1/2 w-[min(27rem,calc(100%-1.5rem))] -translate-x-1/2 -translate-y-1/2 rounded-[28px]'
        }`}
      >
        {practice ? (
          <span
            className="hidden sm:block absolute -left-[7px] top-8 size-3.5 rotate-45 bg-[#FFFcf8] border-l border-b border-[#E7E2D8]"
            aria-hidden
          />
        ) : null}
        <div className="px-5 pt-5 pb-5 sm:px-6 sm:pt-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5" aria-hidden>
              {ONBOARDING_STEPS.map((name, i) => (
                <span
                  key={name}
                  className={`h-1 rounded-full transition-all ${i <= index ? 'w-7 bg-[#2107AA]' : 'w-3 bg-[#E7E2D8]'}`}
                />
              ))}
            </div>
            <button
              type="button"
              className="text-[13px] font-medium text-[#6B6560] hover:text-[#14112B]"
              onClick={() => go('done')}
            >
              {copy.skip}
            </button>
          </div>
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8A847C]">
            {copy.step(index + 1, ONBOARDING_STEPS.length)}
          </p>

          {step === 'level' && (
            <>
              <h2 id="onboarding-title" className="mt-1 font-serif text-[1.65rem] leading-tight text-[#14112B]">
                {copy.levelTitle}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#5C564F]">{copy.levelBody}</p>
              <select
                id="onboarding-level"
                aria-label={copy.levelTitle}
                value={level}
                onChange={(e) => setLevel(e.target.value as CefrLevel)}
                className={`${selectClass} mt-5`}
              >
                {CEFR_LEVELS.map((code) => (
                  <option key={code} value={code}>{code.toUpperCase()}</option>
                ))}
              </select>
              <label htmlFor="onboarding-language" className="mt-5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8A847C]">
                {copy.languageLabel}
              </label>
              <select
                id="onboarding-language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className={selectClass}
              >
                {langs
                  .filter((lang) => lang.code !== user?.nativeLanguage)
                  .map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {languageUiName(lang.code, locale)}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                disabled={busy}
                onClick={() => void saveLevel()}
                className="mt-6 h-12 w-full rounded-2xl bg-[#2107AA] text-white text-sm font-semibold shadow-[0_10px_24px_rgba(33,7,170,0.28)] disabled:opacity-50"
              >
                {copy.next}
              </button>
            </>
          )}

          {step === 'demo' && (
            <>
              <h2 id="onboarding-title" className="mt-1 font-serif text-[1.65rem] leading-tight text-[#14112B]">
                {copy.demoTitle}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#5C564F]">{copy.demoBody}</p>
              <p className="mt-5 rounded-2xl bg-[#F4ECDF] px-4 py-5 font-serif text-[1.125rem] leading-8 text-[#14112B]">
                {SENTENCE.map((word, i) => (
                  <span key={`${word}-${i}`}>
                    {i > 0 ? ' ' : null}
                    {word === 'hesitation' ? (
                      <button
                        type="button"
                        className={`rounded-md px-1 font-semibold underline decoration-2 underline-offset-[5px] ${
                          tapped ? 'bg-[#2107AA] text-white decoration-white/40' : 'text-[#2107AA] decoration-[#2107AA]'
                        }`}
                        onClick={() => setTapped(true)}
                      >
                        {word}
                      </button>
                    ) : (
                      word
                    )}
                  </span>
                ))}
              </p>
              {tapped && (
                <div className="mt-3 rounded-2xl border border-[#E7E2D8] bg-white px-4 py-3.5" data-testid="onboarding-lookup">
                  <div className="font-serif text-xl text-[#14112B]">{copy.demoWord}</div>
                  <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8A847C]">{copy.demoMeaningLabel}</p>
                  <p className="mt-0.5 text-sm leading-6 text-[#14112B]">{copy.demoMeaning}</p>
                  <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8A847C]">{copy.demoTranslationLabel}</p>
                  <p className="mt-0.5 text-sm leading-6 text-[#14112B]">{copy.demoTranslation}</p>
                </div>
              )}
              <div className="mt-6 flex gap-2">
                <button
                  type="button"
                  onClick={() => go('level')}
                  className="h-12 flex-1 rounded-2xl border border-[#E7E2D8] bg-white text-sm font-semibold text-[#14112B]"
                >
                  {copy.back}
                </button>
                <button
                  type="button"
                  disabled={!tapped}
                  onClick={() => go('book')}
                  className="h-12 flex-1 rounded-2xl bg-[#2107AA] text-white text-sm font-semibold shadow-[0_10px_24px_rgba(33,7,170,0.28)] disabled:opacity-40"
                >
                  {copy.next}
                </button>
              </div>
            </>
          )}

          {step === 'book' && (
            <>
              <h2 id="onboarding-title" className="mt-1 font-serif text-[1.65rem] leading-tight text-[#14112B]">
                {copy.bookTitle}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#5C564F]">{copy.bookBody}</p>
              {book ? (
                <div className="mt-5 flex items-center gap-4 rounded-2xl border border-[#E7E2D8] bg-white p-3">
                  <img
                    src={`${import.meta.env.BASE_URL}covers/${book.id}.jpg`}
                    alt=""
                    className="w-[5.25rem] aspect-[2/3] rounded-lg object-cover bg-[#F4ECDF] shadow-[0_8px_18px_rgba(20,17,43,0.16)]"
                  />
                  <div className="min-w-0">
                    <div className="font-serif text-xl leading-tight text-[#14112B]">{book.title}</div>
                    <div className="mt-1 text-sm text-[#5C564F]">{book.author}</div>
                  </div>
                </div>
              ) : null}
              {book ? (
                <button
                  type="button"
                  onClick={openBook}
                  className="mt-6 h-12 w-full rounded-2xl bg-[#2107AA] text-white text-sm font-semibold shadow-[0_10px_24px_rgba(33,7,170,0.28)]"
                >
                  {copy.openBook}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => go('practice')}
                className="mt-1 h-11 w-full rounded-2xl text-sm font-semibold text-[#5C564F] hover:text-[#14112B]"
              >
                {copy.later}
              </button>
            </>
          )}

          {step === 'practice' && (
            <>
              <h2 id="onboarding-title" className="mt-1 font-serif text-[1.65rem] leading-tight text-[#14112B]">
                {copy.practiceTitle}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#5C564F]">{copy.practiceBody}</p>
              <button
                type="button"
                onClick={() => go('done')}
                className="mt-6 h-12 w-full rounded-2xl bg-[#2107AA] text-white text-sm font-semibold shadow-[0_10px_24px_rgba(33,7,170,0.28)]"
              >
                {copy.done}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
