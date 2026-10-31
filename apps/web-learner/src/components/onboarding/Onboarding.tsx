import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CEFR_LEVELS, type CefrLevel } from '@gotcha/shared';
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

const FIRST_BOOKS: Record<string, { id: string; title: string; author: string }> = {
  en: { id: 'b8b9b407-ee72-4332-adc5-37c982ebffcc', title: 'Crime and Punishment', author: 'Fyodor Dostoevsky' },
  tr: { id: '0b029c59-aaa7-4d32-b059-acc883ca40b8', title: 'Şahmerdan', author: 'Sait Faik Abasıyanık' },
};

const SENTENCE = ['He', 'stood', 'still', 'in', 'hesitation', 'at', 'the', 'door.'];

function chipClass(on: boolean) {
  return on
    ? 'bg-[#2107AA] text-white shadow-[0_8px_18px_rgba(33,7,170,0.28)]'
    : 'bg-[#F7F4EE] text-[#14112B] hover:bg-[#EFEAE2]';
}

export function Onboarding({ onStep }: { onStep?: (step: OnboardingStep | 'done') => void }) {
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();
  const { locale } = useLearnerLocale();
  const { langs } = useCatalogLanguages();
  const copy = onboardingCopy(locale);
  const [step, setStep] = useState<OnboardingStep | 'done'>(() => (isOnboardingDone() ? 'done' : readOnboardingStep()));
  const [level, setLevel] = useState<CefrLevel>('a2');
  const [language, setLanguage] = useState('en');
  const [tapped, setTapped] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    onStep?.(step);
  }, [onStep, step]);

  useEffect(() => {
    const native = user?.nativeLanguage;
    const first = langs.find((l) => l.code !== native)?.code;
    if (first) setLanguage(first);
  }, [langs, user?.nativeLanguage]);

  if (step === 'done') return null;

  const index = ONBOARDING_STEPS.indexOf(step);
  const go = (next: OnboardingStep | 'done') => {
    if (next === 'done') {
      markOnboardingDone();
      setStep('done');
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

  const book = FIRST_BOOKS[language] ?? FIRST_BOOKS.en;
  const openBook = () => {
    writeOnboardingStep('practice');
    setStep('practice');
    navigate(`/app/read/${book.id}`);
  };

  const practice = step === 'practice';

  return (
    <div className="fixed inset-0 z-40" data-testid="onboarding" data-onboarding-step={step}>
      <div className="absolute inset-0 bg-[#14112B]/55" />
      <div
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
              <div className="mt-5 grid grid-cols-6 gap-1.5" role="group" aria-label={copy.levelTitle}>
                {CEFR_LEVELS.map((code) => (
                  <button
                    key={code}
                    type="button"
                    aria-pressed={level === code}
                    onClick={() => setLevel(code)}
                    className={`h-11 rounded-2xl text-sm font-semibold ${chipClass(level === code)}`}
                  >
                    {code.toUpperCase()}
                  </button>
                ))}
              </div>
              <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8A847C]">{copy.languageLabel}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {langs.map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    aria-pressed={language === lang.code}
                    onClick={() => setLanguage(lang.code)}
                    className={`h-10 px-3.5 rounded-full text-sm font-semibold ${chipClass(language === lang.code)}`}
                  >
                    {lang.nativeName}
                  </button>
                ))}
              </div>
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
              <button
                type="button"
                onClick={openBook}
                className="mt-6 h-12 w-full rounded-2xl bg-[#2107AA] text-white text-sm font-semibold shadow-[0_10px_24px_rgba(33,7,170,0.28)]"
              >
                {copy.openBook}
              </button>
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
