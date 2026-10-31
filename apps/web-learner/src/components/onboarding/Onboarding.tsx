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

  return (
    <div className="fixed inset-0 z-40 bg-[#101828]/45" data-testid="onboarding" data-onboarding-step={step}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        className={`absolute bg-white rounded-2xl shadow-xl border border-[#e5e7eb] p-5 w-[min(28rem,calc(100%-2rem))] ${
          step === 'practice' ? 'left-[16.5rem] top-28' : 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2'
        }`}
      >
        <div className="flex items-center justify-between gap-3 mb-3">
          <p className="text-xs font-semibold text-[#6a7282]">{copy.step(index + 1, ONBOARDING_STEPS.length)}</p>
          <button type="button" className="text-sm font-medium text-[#4a5565] hover:text-[#101828]" onClick={() => go('done')}>
            {copy.skip}
          </button>
        </div>

        {step === 'level' && (
          <>
            <h2 id="onboarding-title" className="text-xl font-bold text-[#101828]">{copy.levelTitle}</h2>
            <p className="mt-1 text-sm text-[#4a5565]">{copy.levelBody}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {CEFR_LEVELS.map((code) => (
                <button
                  key={code}
                  type="button"
                  aria-pressed={level === code}
                  onClick={() => setLevel(code)}
                  className={`h-10 min-w-12 px-3 rounded-xl text-sm font-bold ${
                    level === code ? 'bg-[#2107aa] text-white' : 'bg-[#f3f4f6] text-[#101828]'
                  }`}
                >
                  {code.toUpperCase()}
                </button>
              ))}
            </div>
            <p className="mt-4 text-xs font-semibold text-[#4a5565]">{copy.languageLabel}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {langs.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  aria-pressed={language === lang.code}
                  onClick={() => setLanguage(lang.code)}
                  className={`h-10 px-3 rounded-xl text-sm font-semibold ${
                    language === lang.code ? 'bg-[#2107aa] text-white' : 'bg-[#f3f4f6] text-[#101828]'
                  }`}
                >
                  {lang.nativeName}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void saveLevel()}
              className="mt-5 h-11 w-full rounded-xl bg-[#2107aa] text-white text-sm font-bold disabled:opacity-50"
            >
              {copy.next}
            </button>
          </>
        )}

        {step === 'demo' && (
          <>
            <h2 id="onboarding-title" className="text-xl font-bold text-[#101828]">{copy.demoTitle}</h2>
            <p className="mt-1 text-sm text-[#4a5565]">{copy.demoBody}</p>
            <p className="mt-4 text-lg leading-relaxed text-[#101828]">
              {SENTENCE.map((word, i) => (
                <span key={`${word}-${i}`}>
                  {i > 0 ? ' ' : null}
                  {word === 'hesitation' ? (
                    <button
                      type="button"
                      className="rounded-md bg-[#ede9fe] px-1 font-semibold text-[#2107aa] underline decoration-2 underline-offset-4"
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
              <div className="mt-4 rounded-2xl border border-[#e5e7eb] p-3" data-testid="onboarding-lookup">
                <div className="text-base font-bold text-[#101828]">{copy.demoWord}</div>
                <p className="mt-2 text-xs font-semibold text-[#6a7282]">{copy.demoMeaningLabel}</p>
                <p className="text-sm text-[#101828]">{copy.demoMeaning}</p>
                <p className="mt-2 text-xs font-semibold text-[#6a7282]">{copy.demoTranslationLabel}</p>
                <p className="text-sm text-[#101828]">{copy.demoTranslation}</p>
              </div>
            )}
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => go('level')} className="h-11 flex-1 rounded-xl border border-[#e5e7eb] text-sm font-semibold">
                {copy.back}
              </button>
              <button
                type="button"
                disabled={!tapped}
                onClick={() => go('book')}
                className="h-11 flex-1 rounded-xl bg-[#2107aa] text-white text-sm font-bold disabled:opacity-50"
              >
                {copy.next}
              </button>
            </div>
          </>
        )}

        {step === 'book' && (
          <>
            <h2 id="onboarding-title" className="text-xl font-bold text-[#101828]">{copy.bookTitle}</h2>
            <p className="mt-1 text-sm text-[#4a5565]">{copy.bookBody}</p>
            <div className="mt-4 flex gap-3 items-center">
              <img
                src={`${import.meta.env.BASE_URL}covers/${book.id}.jpg`}
                alt=""
                className="w-20 aspect-[2/3] rounded-lg object-cover bg-[#F4ECDF]"
              />
              <div>
                <div className="font-bold text-[#101828]">{book.title}</div>
                <div className="text-sm text-[#4a5565]">{book.author}</div>
              </div>
            </div>
            <button type="button" onClick={openBook} className="mt-5 h-11 w-full rounded-xl bg-[#2107aa] text-white text-sm font-bold">
              {copy.openBook}
            </button>
            <button type="button" onClick={() => go('practice')} className="mt-2 h-11 w-full rounded-xl text-sm font-semibold text-[#4a5565]">
              {copy.later}
            </button>
          </>
        )}

        {step === 'practice' && (
          <>
            <h2 id="onboarding-title" className="text-xl font-bold text-[#101828]">{copy.practiceTitle}</h2>
            <p className="mt-1 text-sm text-[#4a5565]">{copy.practiceBody}</p>
            <button type="button" onClick={() => go('done')} className="mt-5 h-11 w-full rounded-xl bg-[#2107aa] text-white text-sm font-bold">
              {copy.done}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
