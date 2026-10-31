/**
 * Public plan copy, uz/ru/en. ONLY claims that are true in the code today (team/marketing/PLUS-OFFER.md §1, 31 Oct 2026).
 * Banned (false or not built): offline reading, "no monthly fee", unlimited imports, priority support, no ads, $ prices.
 * plan-copy.test.ts guards against these strings coming back.
 */
export type PlanLang = 'en' | 'ru' | 'uz';
export const PLAN_LANGS: PlanLang[] = ['en', 'ru', 'uz'];

export function planLang(v: unknown): PlanLang {
  const s = String(v ?? '').toLowerCase().slice(0, 2);
  return s === 'ru' || s === 'uz' ? s : 'en';
}

/** "24 990 soʻm" style: digits grouped with a space; "soʻm" (uz/en) or "сум" (ru). */
export function formatSom(amount: number, lang: PlanLang = 'en'): string {
  const n = Math.max(0, Math.round(Number(amount) || 0));
  const grouped = String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${grouped} ${lang === 'ru' ? 'сум' : 'soʻm'}`;
}

type Cycle = 'daily' | 'monthly' | 'yearly';
/** Russian plural: 1 / 2–4 / 5+ (11–14 → many). */
function ruForm(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

const T = {
  en: {
    freeName: 'Free', freeUnit: 'to start', freeCta: 'Get started',
    library: 'Access to the public library',
    lookupsDay: (n: number) => `${n} word lookups a day`,
    quizzesDay: (n: number) => `${n} chapter quizzes a day`,
    plusLookups: 'Full AI explanations for the words you look up',
    plusQuizzes: (q: number) => `${q} chapter quizzes a day`,
    importsDay: (n: number) => `${n} free ${n === 1 ? 'import' : 'imports'} a day`,
    importPages: (n: number, c: Cycle) => `Up to ${n} free ${n === 1 ? 'page' : 'pages'} of imports a ${c === 'daily' ? 'day' : c === 'yearly' ? 'year' : 'month'}`,
    review: 'Vocabulary review',
    ppiName: 'Pay per import', ppiLabel: 'Pay as you go', ppiUnit: 'one-time payments', ppiCta: 'Start reading for free',
    everythingFree: 'Everything in Free',
    payOnce: 'Need more than your free imports? Pay once per import via Atmos',
    upfront: 'Price shown upfront, based on document length',
    plusFree: 'Everything in Free stays included',
    free: 'Free',
    plusName: 'Plus', passUnit: '30-day pass',
  },
  ru: {
    freeName: 'Бесплатно', freeUnit: 'для начала', freeCta: 'Начать',
    library: 'Доступ к открытой библиотеке',
    lookupsDay: (n: number) => `${n} подсказок по словам в день`,
    quizzesDay: (n: number) => `${n} тестов по главам в день`,
    plusLookups: 'Полные AI-объяснения слов, которые вы ищете',
    plusQuizzes: (q: number) => `${q} тестов по главам в день`,
    importsDay: (n: number) => `${n} ${ruForm(n, 'бесплатный импорт', 'бесплатных импорта', 'бесплатных импортов')} в день`,
    importPages: (n: number, c: Cycle) => `До ${n} ${ruForm(n, 'бесплатной страницы', 'бесплатных страниц', 'бесплатных страниц')} импорта в ${c === 'daily' ? 'день' : c === 'yearly' ? 'год' : 'месяц'}`,
    review: 'Повторение слов',
    ppiName: 'Оплата за импорт', ppiLabel: 'Платите только за то, что нужно', ppiUnit: 'разовые платежи', ppiCta: 'Начать читать бесплатно',
    everythingFree: 'Всё из бесплатного плана',
    payOnce: 'Нужно больше бесплатных импортов? Разовая оплата за импорт через Atmos',
    upfront: 'Цена видна заранее и зависит от объёма документа',
    plusFree: 'Всё из бесплатного плана остаётся с вами',
    free: 'Бесплатно',
    plusName: 'Plus', passUnit: 'доступ на 30 дней',
  },
  uz: {
    freeName: 'Bepul', freeUnit: 'boshlash uchun', freeCta: 'Boshlash',
    library: 'Ochiq kutubxonadan foydalanish',
    lookupsDay: (n: number) => `Kuniga ${n} ta soʻz qidiruvi`,
    quizzesDay: (n: number) => `Kuniga ${n} ta bob testi`,
    plusLookups: 'Qidirgan soʻzlaringiz uchun toʻliq AI izoh',
    plusQuizzes: (q: number) => `Kuniga ${q} ta bob testi`,
    importsDay: (n: number) => `Kuniga ${n} ta bepul import`,
    importPages: (n: number, c: Cycle) => `${c === 'daily' ? 'Kuniga' : c === 'yearly' ? 'Yiliga' : 'Oyiga'} ${n} sahifagacha bepul import`,
    review: "Soʻzlarni takrorlash",
    ppiName: "Har import uchun toʻlov", ppiLabel: "Kerak boʻlganda toʻlang", ppiUnit: "bir martalik toʻlovlar", ppiCta: "Bepul oʻqishni boshlash",
    everythingFree: 'Bepul tarifdagi hamma narsa',
    payOnce: "Bepul importlar yetmayaptimi? Har bir import uchun Atmos orqali bir marta toʻlang",
    upfront: "Narx oldindan koʻrsatiladi va hujjat hajmiga bogʻliq",
    plusFree: 'Bepul tarifdagi hamma narsa sizda qoladi',
    free: 'Bepul',
    plusName: 'Plus', passUnit: '30 kunlik muddat',
  },
} as const;

export const planCopy = (lang: PlanLang) => T[lang];

export const BANNED_PLAN_CLAIMS = [
  /offline/i, /oflayn/i, /офлайн/i,
  /no monthly fee/i, /unlimited (content )?imports/i, /priority support/i, /no ads/i,
  /\$/,
  /unlimited/i, /fair use/i, /200 (word )?lookups/i, /no daily limit/i, /cheksiz/i, /безлимит/i,
];

/**
 * AC1-01 safety net: a public plan price below 1000 soʻm is never shown (the live row still holds the old USD "9").
 * Returns the price in soʻm, or null when it must be hidden (unset, 0, NaN, or < 1000).
 */
export const MIN_PUBLIC_PLAN_PRICE_UZS = 1000;
export function publicPlanPriceUzs(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = Math.round(Number(raw));
  return Number.isFinite(n) && n >= MIN_PUBLIC_PLAN_PRICE_UZS ? n : null;
}
/** Approved Plus prices (option C, Sarvarbek 31 Oct 13:34 via Kai); seed + data fix use these. */
export const PLUS_PRICE_30_UZS = 24990;
export const PLUS_PRICE_365_UZS = 199990;
