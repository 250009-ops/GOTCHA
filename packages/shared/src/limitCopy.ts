/**
 * final-5 (Kai): Free limits and their resets. ALL resets are at 00:00 Asia/Tashkent:
 * daily lookups and quizzes at midnight, monthly import pages at midnight on the 1st. No uncapped or vague-limit wording.
 * r3b: limit bodies are plan-neutral ("You have used all N …"): Plus users hit the same free import pool and a Plus quiz
 * cap, so "Free includes N …" was wrong for them.
 */
export type LimitLang = 'en' | 'ru' | 'uz';
import { LIMIT_TIME_ZONE } from './dailyLimits';

export type LimitCopy = {
  lookupsLeft: (left: number, total: number) => string;
  quizzesLeft: (left: number, total: number) => string;
  importsLeft: (left: number, total: number) => string;
  pagesLeft: (left: number, total: number) => string;
  dailyReset: string;
  monthlyReset: (date: string) => string;
  lookupTitle: string;
  lookupBody: (limit: number) => string;
  quizTitle: string;
  quizBody: (limit: number) => string;
  importTitle: string;
  importDailyBody: (limit: number) => string;
  importMonthlyBody: (limit: number) => string;
  paymentsOff: string;
  ok: string;
  freePlan: string;
};

export const LIMIT_COPY: Record<LimitLang, LimitCopy> = {
  en: {
    lookupsLeft: (l, t) => `Word lookups left today: ${l} of ${t}`,
    quizzesLeft: (l, t) => `Quizzes left today: ${l} of ${t}`,
    importsLeft: (l, t) => `Free imports left today: ${l} of ${t}`,
    pagesLeft: (l, t) => `Free pages left this month: ${l} of ${t}`,
    dailyReset: 'Resets at 00:00 Tashkent time.',
    monthlyReset: (d) => `Pages reset on ${d} at 00:00 Tashkent time.`,
    lookupTitle: 'Daily lookup limit reached',
    lookupBody: (n) => `You have used all ${n} word lookups for today.`,
    quizTitle: 'Daily quiz limit reached',
    quizBody: (n) => `You have used all ${n} quizzes for today.`,
    importTitle: 'Free import limit reached',
    importDailyBody: (n) => `You have used all ${n} free imports for today.`,
    importMonthlyBody: (n) => `You have used all ${n} free pages for this month.`,
    paymentsOff: 'Paid imports are not available yet.',
    ok: 'OK',
    freePlan: 'Free plan',
  },
  ru: {
    lookupsLeft: (l, t) => `Осталось поисков слов сегодня: ${l} из ${t}`,
    quizzesLeft: (l, t) => `Осталось тестов сегодня: ${l} из ${t}`,
    importsLeft: (l, t) => `Осталось бесплатных импортов сегодня: ${l} из ${t}`,
    pagesLeft: (l, t) => `Осталось бесплатных страниц в этом месяце: ${l} из ${t}`,
    dailyReset: 'Обновляется в 00:00 по ташкентскому времени.',
    monthlyReset: (d) => `Страницы обновятся ${d} в 00:00 по ташкентскому времени.`,
    lookupTitle: 'Дневной лимит поиска слов исчерпан',
    lookupBody: (n) => `Вы использовали все поиски слов на сегодня: ${n}.`,
    quizTitle: 'Дневной лимит тестов исчерпан',
    quizBody: (n) => `Вы использовали все тесты на сегодня: ${n}.`,
    importTitle: 'Лимит бесплатных импортов исчерпан',
    importDailyBody: (n) => `Вы использовали все бесплатные импорты на сегодня: ${n}.`,
    importMonthlyBody: (n) => `Вы использовали все бесплатные страницы в этом месяце: ${n}.`,
    paymentsOff: 'Платные импорты пока недоступны.',
    ok: 'OK',
    freePlan: 'Тариф Free',
  },
  uz: {
    lookupsLeft: (l, t) => `Bugun qolgan soʻz qidiruvlari: ${l} / ${t}`,
    quizzesLeft: (l, t) => `Bugun qolgan testlar: ${l} / ${t}`,
    importsLeft: (l, t) => `Bugun qolgan bepul importlar: ${l} / ${t}`,
    pagesLeft: (l, t) => `Bu oy qolgan bepul sahifalar: ${l} / ${t}`,
    dailyReset: 'Toshkent vaqti bilan 00:00 da yangilanadi.',
    monthlyReset: (d) => `Sahifalar ${d} kuni Toshkent vaqti bilan 00:00 da yangilanadi.`,
    lookupTitle: 'Kunlik soʻz qidirish limiti tugadi',
    lookupBody: (n) => `Bugungi ${n} ta soʻz qidiruvi ishlatildi.`,
    quizTitle: 'Kunlik test limiti tugadi',
    quizBody: (n) => `Bugungi ${n} ta test ishlatildi.`,
    importTitle: 'Bepul import limiti tugadi',
    importDailyBody: (n) => `Bugungi ${n} ta bepul import ishlatildi.`,
    importMonthlyBody: (n) => `Bu oydagi ${n} ta bepul sahifa ishlatildi.`,
    paymentsOff: 'Pullik importlar hozircha mavjud emas.',
    ok: 'OK',
    freePlan: 'Free tarifi',
  },
};

export const limitLang = (l?: string | null): LimitLang => (l === 'ru' || l === 'uz' ? l : 'en');

/** Calendar date of an instant in Asia/Tashkent, e.g. "1 Nov 2026" (locale-formatted). */
export function tashkentDate(iso: string, lang: LimitLang): string {
  const loc = lang === 'ru' ? 'ru-RU' : lang === 'uz' ? 'uz-Latn-UZ' : 'en-GB';
  return new Intl.DateTimeFormat(loc, { timeZone: LIMIT_TIME_ZONE, day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
}

/** Next 00:00 Asia/Tashkent (UTC+5, no DST) after `now` — matches the API's resetAt. */
export function nextTashkentMidnight(now = new Date()): Date {
  const off = 5 * 3_600_000;
  const l = new Date(now.getTime() + off);
  return new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate() + 1) - off);
}
/** Next 1st of the month 00:00 Asia/Tashkent. */
export function nextTashkentMonthStart(now = new Date()): Date {
  const off = 5 * 3_600_000;
  const l = new Date(now.getTime() + off);
  return new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth() + 1, 1) - off);
}

export type LimitNotice = { title: string; body: string; reset: string };

/** Builds the limit screen text from an API 403 body (DAILY_LIMIT_REACHED / IMPORT_LIMIT_REACHED / PAYMENTS_DISABLED). */
export function limitNoticeFromError(
  err: { code?: string; body?: Record<string, unknown> } | null | undefined,
  lang: LimitLang,
  now = new Date(),
): LimitNotice | null {
  if (!err?.code) return null;
  const c = LIMIT_COPY[lang];
  const b = (err.body ?? {}) as Record<string, any>;
  if (err.code === 'DAILY_LIMIT_REACHED') {
    const quiz = b.kind === 'quiz';
    const n = Number(b.limit) || (quiz ? 10 : 20);
    return { title: quiz ? c.quizTitle : c.lookupTitle, body: quiz ? c.quizBody(n) : c.lookupBody(n), reset: c.dailyReset };
  }
  if (err.code === 'IMPORT_LIMIT_REACHED') {
    if (b.limit === 'monthly_pages') {
      const at = typeof b.resetAt === 'string' ? b.resetAt : nextTashkentMonthStart(now).toISOString();
      return { title: c.importTitle, body: c.importMonthlyBody(Number(b.monthlyFreePageLimit) || 50), reset: c.monthlyReset(tashkentDate(at, lang)) };
    }
    return { title: c.importTitle, body: c.importDailyBody(Number(b.dailyFreeImportsPerUser) || 3), reset: c.dailyReset };
  }
  if (err.code === 'PAYMENTS_DISABLED') return { title: c.importTitle, body: c.paymentsOff, reset: c.dailyReset };
  return null;
}
