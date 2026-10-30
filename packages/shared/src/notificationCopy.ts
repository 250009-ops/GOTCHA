import type { UiLanguage } from './index';

export interface NotificationParams {
  streakCount?: number;
  firstName?: string;
  goalLeft?: number;
  goalMinutes?: number;
  vocabCount?: number;
  peerName?: string;
  messagePreview?: string;
  contentTitle?: string;
  contentKind?: 'book' | 'article' | 'story' | 'news';
}

type Templates = {
  streakTitle: (days: number) => string;
  streakBody: (firstName: string) => string;
  goalTitle: string;
  goalBody: (left: number, goal: number) => string;
  vocabTitle: string;
  vocabBody: (count: number) => string;
  messageTitle: (peerName: string) => string;
  contentTitle: (kind: NotificationParams['contentKind']) => string;
  contentBody: (title: string) => string;
};

const EN: Templates = {
  streakTitle: (days) => `Don't lose your ${days}-day streak!`,
  streakBody: (name) => `Hi ${name} — read a few minutes today to keep your streak alive.`,
  goalTitle: 'Daily reading goal',
  goalBody: (left, goal) => `${left} min left to hit today's ${goal}-minute goal.`,
  vocabTitle: 'Vocabulary review ready',
  vocabBody: (count) =>
    count === 1 ? 'You have 1 word due for review.' : `You have ${count} words ready for your SRS review.`,
  messageTitle: (peer) => `New message from ${peer}`,
  contentTitle: (kind) => {
    const label = kind === 'news' ? 'news piece' : kind ?? 'book';
    return `New ${label} in the library`;
  },
  contentBody: (title) => `${title} is now available to read.`,
};

const RU: Templates = {
  streakTitle: (days) => `Не потеряйте серию ${days} ${days === 1 ? 'день' : days < 5 ? 'дня' : 'дней'}!`,
  streakBody: (name) => `${name}, прочитайте несколько минут сегодня, чтобы сохранить серию.`,
  goalTitle: 'Дневная цель чтения',
  goalBody: (left, goal) => `Осталось ${left} мин до цели ${goal} мин на сегодня.`,
  vocabTitle: 'Повтор слов готов',
  vocabBody: (count) =>
    count === 1
      ? '1 слово ждёт повторения.'
      : `${count} ${count < 5 ? 'слова' : 'слов'} готовы к повторению.`,
  messageTitle: (peer) => `Новое сообщение от ${peer}`,
  contentTitle: (kind) => {
    const labels = { book: 'книга', article: 'статья', story: 'рассказ', news: 'новость' } as const;
    const label = labels[kind ?? 'book'] ?? 'книга';
    return `Новая ${label} в библиотеке`;
  },
  contentBody: (title) => `«${title}» уже доступна для чтения.`,
};

const UZ: Templates = {
  streakTitle: (days) => `${days} kunlik seriyangizni yoʻqotmang!`,
  streakBody: (name) => `${name}, seriyani saqlab qolish uchun bugun bir necha daqiqa oʻqing.`,
  goalTitle: 'Kunlik oʻqish maqsadi',
  goalBody: (left, goal) => `Bugungi ${goal} daqiqalik maqsadga ${left} daqiqa qoldi.`,
  vocabTitle: 'Soʻzlarni takrorlash tayyor',
  vocabBody: (count) =>
    count === 1
      ? '1 ta soʻz takrorlashga tayyor.'
      : `${count} ta soʻz SRS takroriga tayyor.`,
  messageTitle: (peer) => `${peer} dan yangi xabar`,
  contentTitle: (kind) => {
    const labels = { book: 'kitob', article: 'maqola', story: 'hikoya', news: 'yangilik' } as const;
    const label = labels[kind ?? 'book'] ?? 'kitob';
    return `Kutubxonada yangi ${label}`;
  },
  contentBody: (title) => `«${title}» endi oʻqishga tayyor.`,
};

const TEMPLATES: Record<UiLanguage, Templates> = { en: EN, ru: RU, uz: UZ };

export function normalizeNotificationLocale(code?: string | null): UiLanguage {
  const v = (code ?? '').trim().toLowerCase();
  if (v === 'ru' || v === 'uz' || v === 'en') return v;
  return 'uz';
}

export function parseNotificationParams(kind: string, title: string, body: string): NotificationParams {
  const params: NotificationParams = {};
  if (kind === 'streak') {
    const m = title.match(/(\d+)/);
    params.streakCount = m ? parseInt(m[1], 10) : 0;
    params.firstName =
      body.match(/Hi\s+([^—–-]+)/i)?.[1]?.trim() ||
      body.match(/^([^,—–-]+)/)?.[1]?.trim() ||
      'there';
  } else if (kind === 'goal') {
    const left = body.match(/(\d+)\s*min left/i)?.[1] ?? body.match(/^(\d+)/)?.[1];
    const goal = body.match(/(\d+)-minute goal/i)?.[1] ?? body.match(/(\d+)\s*min/i)?.[1];
    params.goalLeft = left ? parseInt(left, 10) : 1;
    params.goalMinutes = goal ? parseInt(goal, 10) : 15;
  } else if (kind === 'vocab') {
    const m = body.match(/(\d+)/);
    params.vocabCount = m ? parseInt(m[1], 10) : 1;
  } else if (kind === 'message') {
    params.peerName =
      title.replace(/^New message from\s+/i, '').trim() ||
      title.replace(/^Новое сообщение от\s+/i, '').trim() ||
      title.replace(/\s+dan yangi xabar$/i, '').trim() ||
      'A learner';
    params.messagePreview = body;
  } else if (kind === 'content') {
    const kindMatch = title.match(/New\s+(book|article|story|news piece|news)\s+in/i);
    const raw = kindMatch?.[1]?.replace(' news piece', ' news') ?? 'book';
    params.contentKind = raw as NotificationParams['contentKind'];
    params.contentTitle =
      body.match(/^(.+?)\s+is now available/i)?.[1]?.trim() ||
      body.match(/^«(.+?)»/)?.[1]?.trim() ||
      body.replace(/\s+(is now available|уже доступна|endi oʻqishga).*$/i, '').trim();
  }
  return params;
}

export function formatNotification(
  locale: UiLanguage,
  kind: string,
  params: NotificationParams,
  fallback?: { title: string; body: string },
): { title: string; body: string } {
  const t = TEMPLATES[locale] ?? TEMPLATES.uz;
  switch (kind) {
    case 'streak':
      return {
        title: t.streakTitle(params.streakCount ?? 0),
        body: t.streakBody(params.firstName ?? 'there'),
      };
    case 'goal':
      return {
        title: t.goalTitle,
        body: t.goalBody(params.goalLeft ?? 1, params.goalMinutes ?? 15),
      };
    case 'vocab':
      return {
        title: t.vocabTitle,
        body: t.vocabBody(params.vocabCount ?? 1),
      };
    case 'message':
      return {
        title: t.messageTitle(params.peerName ?? 'A learner'),
        body: params.messagePreview ?? fallback?.body ?? '',
      };
    case 'content':
      return {
        title: t.contentTitle(params.contentKind ?? 'book'),
        body: t.contentBody(params.contentTitle ?? fallback?.body ?? ''),
      };
    default:
      return fallback ?? { title: '', body: '' };
  }
}

export function localizeNotificationItem(
  locale: UiLanguage,
  item: { kind: string; title: string; body: string },
): { title: string; body: string } {
  if (item.kind === 'system') {
    return { title: item.title, body: item.body };
  }
  const params = parseNotificationParams(item.kind, item.title, item.body);
  return formatNotification(locale, item.kind, params, item);
}
