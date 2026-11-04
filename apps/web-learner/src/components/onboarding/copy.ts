import type { UiLanguage } from '@gotcha/shared';

export type OnboardingCopy = {
  skip: string;
  next: string;
  back: string;
  done: string;
  step: (n: number, total: number) => string;
  levelTitle: string;
  levelBody: string;
  languageLabel: string;
  demoTitle: string;
  demoBody: string;
  demoWord: string;
  demoMeaningLabel: string;
  demoMeaning: string;
  demoTranslationLabel: string;
  demoTranslation: string;
  bookTitle: string;
  bookBody: string;
  openBook: string;
  later: string;
  practiceTitle: string;
  practiceBody: string;
};

const en: OnboardingCopy = {
  skip: 'Skip',
  next: 'Continue',
  back: 'Back',
  done: 'Got it',
  step: (n, total) => `Step ${n} of ${total}`,
  levelTitle: 'Your level and language',
  levelBody: 'We use this to pick your first book and your Practice deck.',
  languageLabel: 'Language you are learning',
  demoTitle: 'Tap any word',
  demoBody: 'In a book, tap a word to see what it means. Try it on the highlighted word.',
  demoWord: 'hesitation',
  demoMeaningLabel: 'Natural meaning',
  demoMeaning: 'A pause before you decide.',
  demoTranslationLabel: 'Translation',
  demoTranslation: 'hesitation',
  bookTitle: 'Your first book',
  bookBody: 'Start with a short read. Tap words as you go.',
  openBook: 'Open this book',
  later: 'I will read it later',
  practiceTitle: 'Practice is here',
  practiceBody: 'After you save words, Practice turns them into a short daily quiz.',
};

const ru: OnboardingCopy = {
  skip: 'Пропустить',
  next: 'Дальше',
  back: 'Назад',
  done: 'Понятно',
  step: (n, total) => `Шаг ${n} из ${total}`,
  levelTitle: 'Уровень и язык',
  levelBody: 'Так мы выберем первую книгу и колоду для практики.',
  languageLabel: 'Язык, который вы учите',
  demoTitle: 'Нажмите на слово',
  demoBody: 'В книге нажмите на слово, чтобы увидеть значение. Попробуйте на выделенном.',
  demoWord: 'hesitation',
  demoMeaningLabel: 'Значение',
  demoMeaning: 'Пауза перед решением.',
  demoTranslationLabel: 'Перевод',
  demoTranslation: 'колебание',
  bookTitle: 'Первая книга',
  bookBody: 'Начните с короткого текста и нажимайте на слова.',
  openBook: 'Открыть книгу',
  later: 'Прочитаю позже',
  practiceTitle: 'Практика здесь',
  practiceBody: 'Сохранённые слова превращаются в короткую ежедневную тренировку.',
};

const uz: OnboardingCopy = {
  skip: 'Oʻtkazib yuborish',
  next: 'Davom etish',
  back: 'Orqaga',
  done: 'Tushundim',
  step: (n, total) => `${n}-qadam, jami ${total}`,
  levelTitle: 'Daraja va til',
  levelBody: 'Birinchi kitob va mashq toʻplami shu boʻyicha tanlanadi.',
  languageLabel: 'Oʻrganayotgan tilingiz',
  demoTitle: 'Soʻzni bosing',
  demoBody: 'Kitobda soʻzni bosing — maʼnosi ochiladi. Belgilangan soʻzda sinab koʻring.',
  demoWord: 'hesitation',
  demoMeaningLabel: 'Maʼno',
  demoMeaning: 'Qaror oldidan toʻxtab qolish.',
  demoTranslationLabel: 'Tarjima',
  demoTranslation: 'ikkilanish',
  bookTitle: 'Birinchi kitob',
  bookBody: 'Qisqa matndan boshlang va soʻzlarni bosing.',
  openBook: 'Kitobni ochish',
  later: 'Keyinroq oʻqiyman',
  practiceTitle: 'Mashq shu yerda',
  practiceBody: 'Saqlangan soʻzlar har kungi qisqa mashqqa aylanadi.',
};

export const ONBOARDING_COPY: Record<UiLanguage, OnboardingCopy> = { en, ru, uz };

export function onboardingCopy(locale: string): OnboardingCopy {
  if (locale === 'ru' || locale === 'uz') return ONBOARDING_COPY[locale];
  return ONBOARDING_COPY.en;
}
