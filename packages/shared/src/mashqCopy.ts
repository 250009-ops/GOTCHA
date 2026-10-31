export type MashqLang = 'en' | 'uz' | 'ru';

const lang3 = (l: string | null | undefined): MashqLang => (l === 'uz' || l === 'ru' ? l : 'en');

const mashq = {
  en: {
    pill: 'Practice this page',
    cardTitle: 'Practice this page',
    cardBody: 'A few questions from the page you just read.',
    start: 'Start',
    later: 'Later',
    howMany: 'How many questions?',
    repeat: 'Redo today’s mistakes',
    limitTitle: 'Today’s free questions are used up',
    limitBody: 'Plus has no daily cap on Practice.',
    seePlus: 'See Plus',
    shortPage: 'This page is too short for Practice.',
  },
  uz: {
    pill: 'Shu sahifa boʻyicha mashq',
    cardTitle: 'Shu sahifa boʻyicha mashq',
    cardBody: 'Hozir oʻqigan sahifangizdan bir nechta savol.',
    start: 'Boshlash',
    later: 'Keyinroq',
    howMany: 'Nechta savol?',
    repeat: 'Bugungi xatolarni qayta ishlash',
    limitTitle: 'Bugungi bepul savollar tugadi',
    limitBody: 'Plusda Mashq uchun kunlik cheklov yoʻq.',
    seePlus: 'Plusni koʻrish',
    shortPage: 'Bu sahifa Mashq uchun juda qisqa.',
  },
  ru: {
    pill: 'Практика по этой странице',
    cardTitle: 'Практика по этой странице',
    cardBody: 'Несколько вопросов по странице, которую вы только что прочитали.',
    start: 'Начать',
    later: 'Позже',
    howMany: 'Сколько вопросов?',
    repeat: 'Повторить сегодняшние ошибки',
    limitTitle: 'Бесплатные вопросы на сегодня закончились',
    limitBody: 'В Plus нет дневного лимита на Практику.',
    seePlus: 'Смотреть Plus',
    shortPage: 'Эта страница слишком короткая для Практики.',
  },
} as const;

export function mashqCopy(lang: string | null | undefined) {
  return mashq[lang3(lang)];
}

const surface = {
  en: {
    tapWord: 'Tap a word to catch its phrase, or drag any span — even the whole page',
    fileTooBig: (mb: number) => `File exceeds the ${mb} MB limit`,
    grammarNote: 'Grammar note',
    fewerBooks: 'Fewer books',
    moreBooks: 'More books/day',
    heatmapEmpty: 'Activity heatmap will appear as you learn',
    orPressSpace: 'or press Space',
  },
  uz: {
    tapWord: 'Soʻzga bosing — iborasi chiqadi, yoki istalgan joyni belgilang, hatto butun sahifani',
    fileTooBig: (mb: number) => `Fayl ${mb} MB chegarasidan oshib ketdi`,
    grammarNote: 'Grammatika izohi',
    fewerBooks: 'Kamroq kitob',
    moreBooks: 'Koʻproq kitob/kun',
    heatmapEmpty: 'Faollik xaritasi oʻqishni boshlaganingizda chiqadi',
    orPressSpace: 'yoki Probelni bosing',
  },
  ru: {
    tapWord: 'Нажмите на слово, чтобы поймать фразу, или выделите любой фрагмент — хоть всю страницу',
    fileTooBig: (mb: number) => `Файл больше лимита ${mb} МБ`,
    grammarNote: 'Заметка о грамматике',
    fewerBooks: 'Меньше книг',
    moreBooks: 'Больше книг/день',
    heatmapEmpty: 'Карта активности появится, когда вы начнёте заниматься',
    orPressSpace: 'или нажмите Пробел',
  },
} as const;

export function surfaceCopy(lang: string | null | undefined) {
  return surface[lang3(lang)];
}
