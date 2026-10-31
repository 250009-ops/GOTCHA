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

const T = {
  en: {
    freeName: 'Free', freeUnit: 'to start', freeCta: 'Get started',
    library: 'Access to the public library',
    lookupsDay: (n: number) => `${n} word lookups a day`,
    importsDay: (n: number) => `${n} free imports a day`,
    review: 'Vocabulary review',
    ppiName: 'Pay per import', ppiLabel: 'Pay as you go', ppiUnit: 'one-time payments', ppiCta: 'Start reading for free',
    everythingFree: 'Everything in Free',
    payOnce: 'Need more than your free imports? Pay once per import via Atmos',
    upfront: 'Price shown upfront, based on document length',
    plusLookups: 'No daily limit on word lookups and chapter quizzes (fair use)',
    plusFree: 'Everything in Free stays included',
    free: 'Free',
  },
  ru: {
    freeName: 'Бесплатно', freeUnit: 'для начала', freeCta: 'Начать',
    library: 'Доступ к открытой библиотеке',
    lookupsDay: (n: number) => `${n} подсказок по словам в день`,
    importsDay: (n: number) => `${n} бесплатных импортов в день`,
    review: 'Повторение слов',
    ppiName: 'Оплата за импорт', ppiLabel: 'Платите по мере надобности', ppiUnit: 'разовые платежи', ppiCta: 'Начать читать бесплатно',
    everythingFree: 'Всё из бесплатного плана',
    payOnce: 'Нужно больше бесплатных импортов? Разовая оплата за импорт через Atmos',
    upfront: 'Цена видна заранее и зависит от объёма документа',
    plusLookups: 'Без дневного лимита на подсказки и тесты по главам (в разумных пределах)',
    plusFree: 'Всё из бесплатного плана остаётся с вами',
    free: 'Бесплатно',
  },
  uz: {
    freeName: 'Bepul', freeUnit: 'boshlash uchun', freeCta: 'Boshlash',
    library: 'Ochiq kutubxonadan foydalanish',
    lookupsDay: (n: number) => `Kuniga ${n} ta so'z qidiruvi`,
    importsDay: (n: number) => `Kuniga ${n} ta bepul import`,
    review: "So'zlarni takrorlash",
    ppiName: "Har import uchun to'lov", ppiLabel: "Kerak bo'lganda to'lang", ppiUnit: "bir martalik to'lovlar", ppiCta: "Bepul o'qishni boshlash",
    everythingFree: 'Bepul tarifdagi hamma narsa',
    payOnce: "Bepul importlar yetmayaptimi? Har bir import uchun Atmos orqali bir marta to'lang",
    upfront: "Narx oldindan ko'rsatiladi va hujjat hajmiga bog'liq",
    plusLookups: "So'z qidiruvi va bob testlariga kunlik cheklov yo'q (oqilona foydalanish)",
    plusFree: 'Bepul tarifdagi hamma narsa sizda qoladi',
    free: 'Bepul',
  },
} as const;

export const planCopy = (lang: PlanLang) => T[lang];

export const BANNED_PLAN_CLAIMS = [
  /offline/i, /oflayn/i, /офлайн/i,
  /no monthly fee/i, /unlimited (content )?imports/i, /priority support/i, /no ads/i,
  /\$/,
];
