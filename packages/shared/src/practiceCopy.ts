import type { ExerciseType } from './practice';

export interface PracticeCopy {
  title: string;
  subtitle: string;
  myWordsTab: string;
  chapterQuizTab: string;
  startSession: string;
  continueSession: string;
  dueNow: (n: number) => string;
  newWords: (n: number) => string;
  sessionLength: string;
  short: string;
  normal: string;
  long: string;
  dailyGoal: string;
  xpToday: (xp: number, goal: number) => string;
  streakDays: (n: number) => string;
  goalReached: string;
  emptyTitle: string;
  emptyBody: string;
  goToLibrary: string;
  check: string;
  continue: string;
  skip: string;
  showAnswer: string;
  hint: string;
  typeHere: string;
  correct: string;
  almost: string;
  incorrect: string;
  correctAnswerIs: string;
  yourAnswer: string;
  accentNote: string;
  typoNote: string;
  playAudio: string;
  playSlow: string;
  tapWordsInOrder: string;
  reset: string;
  startRecording: string;
  stopRecording: string;
  listening: string;
  heard: string;
  speechUnsupported: string;
  rateHow: string;
  again: string;
  hard: string;
  good: string;
  easy: string;
  shortcuts: string;
  progress: (done: number, total: number) => string;
  summaryTitle: string;
  accuracy: string;
  xpEarned: string;
  wordsPracticed: string;
  mistakesToReview: string;
  noMistakes: string;
  nextReview: string;
  practiceMistakes: string;
  newSession: string;
  backToVocabulary: string;
  exitConfirm: string;
  keyboardHint: string;
  audioUnavailable: string;
  appTheme: string;
  themeSystem: string;
  themeLight: string;
  themeDark: string;
  shortcutsTitle: string;
  endSession: string;
  uzApostropheNote: string;
  realWordNote: string;
  freezes: (n: number) => string;
  freezeUsed: string;
  goalPicker: string;
  goalNames: Record<30 | 60 | 120 | 200, string>;
  allCaughtUp: string;
  practiceExtra: string;
  extraNote: string;
  cantListen: string;
  willRetry: string;
  dueTomorrow: (n: number) => string;
  hardestWords: string;
  continueReading: string;
  replay: string;
  prompts: Record<ExerciseType, string>;
  typeNames: Record<ExerciseType, string>;
}

const en: PracticeCopy = {
  title: 'Practice',
  subtitle: 'Short mixed sessions built from the words you saved while reading.',
  myWordsTab: 'My words',
  chapterQuizTab: 'Chapter quiz',
  startSession: 'Start practice',
  continueSession: 'Keep going',
  dueNow: (n) => `${n} due now`,
  newWords: (n) => `${n} new`,
  sessionLength: 'Session length',
  short: 'Quick · 10',
  normal: 'Standard · 15',
  long: 'Deep · 25',
  dailyGoal: 'Daily goal',
  xpToday: (xp, goal) => `${xp} / ${goal} XP today`,
  streakDays: (n) => `${n}-day streak`,
  goalReached: 'Daily goal reached!',
  emptyTitle: 'No words to practice yet',
  emptyBody: 'Tap words while reading and save them. They will show up here with their real sentences.',
  goToLibrary: 'Open the library',
  check: 'Check',
  continue: 'Continue',
  skip: "I don't know",
  showAnswer: 'Show answer',
  hint: 'Hint',
  typeHere: 'Type your answer…',
  correct: 'Correct!',
  almost: 'Almost — accepted',
  incorrect: 'Not quite',
  correctAnswerIs: 'Correct answer',
  yourAnswer: 'Your answer',
  accentNote: 'Watch the accents / special letters.',
  typoNote: 'Small typo — check the spelling.',
  playAudio: 'Play',
  playSlow: 'Slow',
  tapWordsInOrder: 'Tap the words in the right order',
  reset: 'Reset',
  startRecording: 'Tap and speak',
  stopRecording: 'Stop',
  listening: 'Listening…',
  heard: 'We heard',
  speechUnsupported: 'Speech recognition is not supported in this browser — type it instead.',
  rateHow: 'How well did you know it?',
  again: 'Again',
  hard: 'Hard',
  good: 'Good',
  easy: 'Easy',
  shortcuts: 'Enter = check · 1–4 = choose · Space = flip',
  progress: (d, t) => `${d} of ${t}`,
  summaryTitle: 'Session complete',
  accuracy: 'Accuracy',
  xpEarned: 'XP earned',
  wordsPracticed: 'Words practiced',
  mistakesToReview: 'Review your mistakes',
  noMistakes: 'Flawless — no mistakes this time.',
  nextReview: 'Next review',
  practiceMistakes: 'Practice mistakes again',
  newSession: 'New session',
  backToVocabulary: 'Vocabulary',
  exitConfirm: 'Leave this session? Progress so far is saved.',
  keyboardHint: 'Switch your keyboard to Cyrillic for Russian answers.',
  audioUnavailable: 'Audio unavailable — skipped without penalty.',
  appTheme: 'Appearance',
  themeSystem: 'System',
  themeLight: 'Light',
  themeDark: 'Dark',
  shortcutsTitle: 'Keyboard shortcuts',
  endSession: 'End session',
  uzApostropheNote: 'Mind the oʻ / gʻ apostrophe.',
  realWordNote: 'That is a different word.',
  freezes: (n) => `${n} streak freeze${n === 1 ? '' : 's'}`,
  freezeUsed: 'A streak freeze covered a missed day',
  goalPicker: 'Daily XP goal',
  goalNames: { 30: 'Casual · 30 XP', 60: 'Regular · 60 XP', 120: 'Serious · 120 XP', 200: 'Intense · 200 XP' },
  allCaughtUp: 'All caught up! No reviews are due.',
  practiceExtra: 'Practice extra',
  extraNote: 'Extra practice: half XP, schedule unchanged.',
  cantListen: "Can't listen now",
  willRetry: 'You will see this word again shortly.',
  dueTomorrow: (n) => `Due tomorrow: ${n}`,
  hardestWords: 'Hardest words',
  continueReading: 'Continue reading',
  replay: 'Replay',
  prompts: {
    flashcard: 'Do you remember what this means?',
    mcq_meaning: 'Choose the correct meaning',
    typed_recall: 'Type the word for',
    cloze: 'Fill in the missing word',
    cloze_mcq: 'Choose the word that fits',
    listening_mcq: 'Pick what you hear',
    dictation: 'Type what you hear',
  },
  typeNames: {
    flashcard: 'Flashcard',
    mcq_meaning: 'Meaning',
    typed_recall: 'Recall',
    cloze: 'Context',
    cloze_mcq: 'Context',
    listening_mcq: 'Listening',
    dictation: 'Dictation',
  },
};

const ru: PracticeCopy = {
  title: 'Практика',
  subtitle: 'Короткие смешанные сессии из слов, которые вы сохранили при чтении.',
  myWordsTab: 'Мои слова',
  chapterQuizTab: 'Тест по главе',
  startSession: 'Начать практику',
  continueSession: 'Продолжить',
  dueNow: (n) => `${n} к повторению`,
  newWords: (n) => `${n} новых`,
  sessionLength: 'Длина сессии',
  short: 'Быстро · 10',
  normal: 'Обычно · 15',
  long: 'Глубоко · 25',
  dailyGoal: 'Цель дня',
  xpToday: (xp, goal) => `${xp} / ${goal} XP сегодня`,
  streakDays: (n) => `Серия: ${n} дн.`,
  goalReached: 'Цель дня выполнена!',
  emptyTitle: 'Пока нет слов для практики',
  emptyBody: 'Нажимайте на слова при чтении и сохраняйте их — они появятся здесь вместе с реальными предложениями.',
  goToLibrary: 'Открыть библиотеку',
  check: 'Проверить',
  continue: 'Дальше',
  skip: 'Не знаю',
  showAnswer: 'Показать ответ',
  hint: 'Подсказка',
  typeHere: 'Введите ответ…',
  correct: 'Верно!',
  almost: 'Почти — засчитано',
  incorrect: 'Неверно',
  correctAnswerIs: 'Правильный ответ',
  yourAnswer: 'Ваш ответ',
  accentNote: 'Обратите внимание на диакритику и особые буквы.',
  typoNote: 'Небольшая опечатка — проверьте написание.',
  playAudio: 'Слушать',
  playSlow: 'Медленно',
  tapWordsInOrder: 'Нажимайте слова в правильном порядке',
  reset: 'Сбросить',
  startRecording: 'Нажмите и говорите',
  stopRecording: 'Стоп',
  listening: 'Слушаю…',
  heard: 'Мы услышали',
  speechUnsupported: 'Браузер не поддерживает распознавание речи — введите ответ.',
  rateHow: 'Насколько хорошо вы помнили?',
  again: 'Снова',
  hard: 'Трудно',
  good: 'Хорошо',
  easy: 'Легко',
  shortcuts: 'Enter — проверить · 1–4 — выбрать · Пробел — перевернуть',
  progress: (d, t) => `${d} из ${t}`,
  summaryTitle: 'Сессия завершена',
  accuracy: 'Точность',
  xpEarned: 'Получено XP',
  wordsPracticed: 'Слов повторено',
  mistakesToReview: 'Разбор ошибок',
  noMistakes: 'Без единой ошибки!',
  nextReview: 'Следующее повторение',
  practiceMistakes: 'Повторить ошибки',
  newSession: 'Новая сессия',
  backToVocabulary: 'Словарь',
  exitConfirm: 'Выйти из сессии? Прогресс уже сохранён.',
  keyboardHint: 'Переключите клавиатуру на кириллицу.',
  audioUnavailable: 'Аудио недоступно — пропущено без штрафа.',
  appTheme: 'Оформление',
  themeSystem: 'Системная',
  themeLight: 'Светлая',
  themeDark: 'Тёмная',
  shortcutsTitle: 'Горячие клавиши',
  endSession: 'Завершить',
  uzApostropheNote: 'Обратите внимание на апостроф в oʻ / gʻ.',
  realWordNote: 'Это другое слово.',
  freezes: (n) => `Заморозок серии: ${n}`,
  freezeUsed: 'Заморозка сохранила серию за пропущенный день',
  goalPicker: 'Цель XP на день',
  goalNames: { 30: 'Легко · 30 XP', 60: 'Обычно · 60 XP', 120: 'Серьёзно · 120 XP', 200: 'Интенсивно · 200 XP' },
  allCaughtUp: 'Всё повторено! Сейчас ничего не нужно.',
  practiceExtra: 'Дополнительная практика',
  extraNote: 'Доп. практика: половина XP, расписание не меняется.',
  cantListen: 'Не могу слушать',
  willRetry: 'Это слово скоро появится снова.',
  dueTomorrow: (n) => `Завтра к повторению: ${n}`,
  hardestWords: 'Самые трудные слова',
  continueReading: 'Продолжить чтение',
  replay: 'Повторить',
  prompts: {
    flashcard: 'Помните, что это значит?',
    mcq_meaning: 'Выберите правильное значение',
    typed_recall: 'Напишите слово:',
    cloze: 'Вставьте пропущенное слово',
    cloze_mcq: 'Выберите подходящее слово',
    listening_mcq: 'Выберите, что слышите',
    dictation: 'Напишите, что слышите',
  },
  typeNames: {
    flashcard: 'Карточка',
    mcq_meaning: 'Значение',
    typed_recall: 'Вспомнить',
    cloze: 'Контекст',
    cloze_mcq: 'Контекст',
    listening_mcq: 'Аудирование',
    dictation: 'Диктант',
  },
};

const uz: PracticeCopy = {
  title: 'Mashq',
  subtitle: "O'qish paytida saqlagan so'zlaringizdan tuzilgan qisqa aralash mashg'ulotlar.",
  myWordsTab: "Mening so'zlarim",
  chapterQuizTab: 'Bob bo‘yicha test',
  startSession: 'Mashqni boshlash',
  continueSession: 'Davom etish',
  dueNow: (n) => `${n} ta takrorlash vaqti keldi`,
  newWords: (n) => `${n} ta yangi`,
  sessionLength: "Mashg'ulot uzunligi",
  short: 'Tez · 10',
  normal: 'Odatiy · 15',
  long: 'Chuqur · 25',
  dailyGoal: 'Kunlik maqsad',
  xpToday: (xp, goal) => `Bugun ${xp} / ${goal} XP`,
  streakDays: (n) => `${n} kunlik seriya`,
  goalReached: 'Kunlik maqsad bajarildi!',
  emptyTitle: "Hozircha mashq uchun so'z yo'q",
  emptyBody: "O'qish paytida so'zlarni bosing va saqlang — ular haqiqiy gaplari bilan shu yerda paydo bo'ladi.",
  goToLibrary: 'Kutubxonani ochish',
  check: 'Tekshirish',
  continue: 'Davom etish',
  skip: 'Bilmayman',
  showAnswer: 'Javobni ko‘rsatish',
  hint: 'Yordam',
  typeHere: 'Javobingizni yozing…',
  correct: "To'g'ri!",
  almost: 'Deyarli — qabul qilindi',
  incorrect: "Noto'g'ri",
  correctAnswerIs: "To'g'ri javob",
  yourAnswer: 'Sizning javobingiz',
  accentNote: "Maxsus harflar va belgilarga e'tibor bering.",
  typoNote: "Kichik xato — imloni tekshiring.",
  playAudio: 'Tinglash',
  playSlow: 'Sekin',
  tapWordsInOrder: "So'zlarni to'g'ri tartibda bosing",
  reset: 'Qaytadan',
  startRecording: 'Bosing va gapiring',
  stopRecording: "To'xtatish",
  listening: 'Tinglanmoqda…',
  heard: 'Biz eshitdik',
  speechUnsupported: "Brauzer nutqni tanishni qo'llab-quvvatlamaydi — javobni yozing.",
  rateHow: 'Qanchalik yaxshi esladingiz?',
  again: 'Yana',
  hard: 'Qiyin',
  good: 'Yaxshi',
  easy: 'Oson',
  shortcuts: 'Enter — tekshirish · 1–4 — tanlash · Probel — aylantirish',
  progress: (d, t) => `${t} tadan ${d}`,
  summaryTitle: "Mashg'ulot yakunlandi",
  accuracy: 'Aniqlik',
  xpEarned: 'Olingan XP',
  wordsPracticed: "Mashq qilingan so'zlar",
  mistakesToReview: 'Xatolar tahlili',
  noMistakes: 'Birorta ham xato yo‘q!',
  nextReview: 'Keyingi takrorlash',
  practiceMistakes: 'Xatolarni qayta mashq qilish',
  newSession: "Yangi mashg'ulot",
  backToVocabulary: "Lug'at",
  exitConfirm: "Mashg'ulotdan chiqasizmi? Natijalar saqlangan.",
  keyboardHint: "Rus tilidagi javob uchun klaviaturani kirillchaga o'tkazing.",
  audioUnavailable: 'Audio mavjud emas — jarimasiz o‘tkazib yuborildi.',
  appTheme: 'Ko‘rinish',
  themeSystem: 'Tizim',
  themeLight: 'Yorug‘',
  themeDark: 'Qorong‘i',
  shortcutsTitle: 'Tezkor tugmalar',
  endSession: 'Yakunlash',
  uzApostropheNote: "oʻ / gʻ dagi tutuq belgisiga e'tibor bering.",
  realWordNote: "Bu boshqa so'z.",
  freezes: (n) => `${n} ta seriya muzlatgichi`,
  freezeUsed: "Muzlatgich o'tkazib yuborilgan kunni saqlab qoldi",
  goalPicker: 'Kunlik XP maqsadi',
  goalNames: { 30: 'Yengil · 30 XP', 60: 'Odatiy · 60 XP', 120: 'Jiddiy · 120 XP', 200: 'Intensiv · 200 XP' },
  allCaughtUp: "Hammasi takrorlandi! Hozircha takrorlash yo'q.",
  practiceExtra: "Qo'shimcha mashq",
  extraNote: "Qo'shimcha mashq: yarim XP, jadval o'zgarmaydi.",
  cantListen: 'Hozir tinglay olmayman',
  willRetry: "Bu so'z tez orada yana chiqadi.",
  dueTomorrow: (n) => `Ertaga takrorlash: ${n}`,
  hardestWords: "Eng qiyin so'zlar",
  continueReading: "O'qishni davom ettirish",
  replay: 'Qayta tinglash',
  prompts: {
    flashcard: "Bu so'z nimani anglatishini eslaysizmi?",
    mcq_meaning: "To'g'ri ma'noni tanlang",
    typed_recall: "So'zni yozing:",
    cloze: "Tushib qolgan so'zni yozing",
    cloze_mcq: "Mos so'zni tanlang",
    listening_mcq: 'Eshitganingizni tanlang',
    dictation: 'Eshitganingizni yozing',
  },
  typeNames: {
    flashcard: 'Kartochka',
    mcq_meaning: "Ma'no",
    typed_recall: 'Eslash',
    cloze: 'Kontekst',
    cloze_mcq: 'Kontekst',
    listening_mcq: 'Tinglash',
    dictation: 'Diktant',
  },
};

export const PRACTICE_COPY: Record<'en' | 'ru' | 'uz', PracticeCopy> = { en, ru, uz };

export function practiceCopyFor(locale?: string | null): PracticeCopy {
  return PRACTICE_COPY[(locale as 'en' | 'ru' | 'uz') ?? 'en'] ?? en;
}

/** App-wide colour theme preference (DESIGN-practice §0 gap 1). */
export const APP_THEMES = ['system', 'light', 'dark'] as const;
export type AppTheme = (typeof APP_THEMES)[number];
