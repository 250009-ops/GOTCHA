import { botButtons, botLocale, confirmedHtml, linkStaleHtml, welcomeHtml, type BotLocale } from './copy';
import { miniAppUrl, type BotButton } from './telegram-api';
import type { TelegramLoginService } from './telegram-login.service';

export interface TelegramFrom {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface TelegramUpdateBody {
  message?: {
    text?: string;
    from?: TelegramFrom;
    contact?: { phone_number?: string; user_id?: number };
  };
  callback_query?: {
    id?: string;
    data?: string;
    from?: TelegramFrom;
  };
}

export interface Outgoing {
  chatId: number;
  text: string;
  rows?: BotButton[][];
  photo?: boolean;
}

/**
 * Turns a Telegram update into bot replies. The webhook feeds this from grammY.
 * Contact shares are kept only when contact.user_id is the sender.
 */
export async function handleTelegramUpdate(
  update: TelegramUpdateBody,
  login: TelegramLoginService,
  send: (message: Outgoing) => Promise<void>,
): Promise<void> {
  const callback = update.callback_query;
  if (callback?.from && callback.data) {
    await onCallback(callback.from, callback.data, login, send);
    return;
  }
  const message = update.message;
  const from = message?.from;
  if (!from) return;
  if (message?.contact) {
    await onContact(from, message.contact, login, send);
    return;
  }
  const text = message?.text?.trim() ?? '';
  if (!text.startsWith('/start')) return;
  const payload = text.replace(/^\/start(?:@\w+)?/, '').trim();
  await onStart(from, payload, login, send);
}

async function onStart(
  from: TelegramFrom,
  payload: string,
  login: TelegramLoginService,
  send: (message: Outgoing) => Promise<void>,
) {
  const locale = botLocale(from.language_code);
  const telegramId = BigInt(from.id);
  const linked = await login.userByTelegram(telegramId);
  if (linked) await login.clearBlocked(linked.id).catch(() => undefined);

  if (payload.startsWith('login_')) {
    await onLoginStart(from, payload.slice('login_'.length), locale, linked, login, send);
    return;
  }

  if (!linked) {
    await login.rememberVisitor({
      telegramId,
      firstName: from.first_name ?? '',
      lastName: from.last_name ?? '',
      username: from.username ?? null,
    });
  }
  await send(welcomeCard(from, locale, Boolean(linked)));
}

async function onLoginStart(
  from: TelegramFrom,
  token: string,
  locale: BotLocale,
  linked: { id: string; displayName: string | null; uiLanguage: string } | null,
  login: TelegramLoginService,
  send: (message: Outgoing) => Promise<void>,
) {
  const challenge = token ? await login.challengeForToken(token) : null;
  const open = challenge && challenge.kind === 'link' && challenge.status === 'pending' && challenge.expiresAt.getTime() > Date.now();
  if (!open) {
    await send({ chatId: from.id, text: linkStaleHtml(locale) });
    return;
  }
  if (!linked) {
    const card = login.notLinkedCard(locale);
    await send({ chatId: from.id, text: card.text, rows: card.rows });
    return;
  }
  const cardLocale = botLocale(linked.uiLanguage);
  const card = login.confirmCard(cardLocale, linked.displayName ?? from.first_name ?? '', challenge.userAgent, challenge.id);
  await send({ chatId: from.id, text: card.text, rows: card.rows });
}

async function onContact(
  from: TelegramFrom,
  contact: { phone_number?: string; user_id?: number },
  login: TelegramLoginService,
  send: (message: Outgoing) => Promise<void>,
) {
  const locale = botLocale(from.language_code);
  const result = await login.acceptContact({
    fromId: from.id,
    contactUserId: contact.user_id,
    phone: contact.phone_number ?? '',
    firstName: from.first_name ?? '',
    lastName: from.last_name ?? '',
    username: from.username ?? null,
    locale,
  });
  if (result === 'taken') {
    const card = login.phoneTakenReply(locale);
    await send({ chatId: from.id, text: card.text, rows: card.rows });
  }
}

async function onCallback(
  from: TelegramFrom,
  data: string,
  login: TelegramLoginService,
  send: (message: Outgoing) => Promise<void>,
) {
  const locale = botLocale(from.language_code);
  const [action, id] = data.split(':');
  if (!id || (action !== 'ok' && action !== 'no')) return;
  const telegramId = BigInt(from.id);
  if (action === 'ok') {
    const result = await login.approve(id, telegramId);
    if (result === 'unlinked') {
      const card = login.notLinkedCard(locale);
      await send({ chatId: from.id, text: card.text, rows: card.rows });
      return;
    }
    if (result === 'approved') await send({ chatId: from.id, text: confirmedHtml(locale) });
    return;
  }
  const result = await login.deny(id, telegramId);
  if (result === 'denied') {
    const card = login.deniedCard(locale);
    await send({ chatId: from.id, text: card.text, rows: card.rows });
  }
}

function welcomeCard(from: TelegramFrom, locale: BotLocale, linked: boolean): Outgoing {
  const labels = botButtons(locale);
  const rows = linked
    ? [[{ text: labels.open, webApp: miniAppUrl() }]]
    : [[
        { text: labels.signup, webApp: miniAppUrl('/signup') },
        { text: labels.login, webApp: miniAppUrl('/login') },
      ]];
  return {
    chatId: from.id,
    text: welcomeHtml(locale, from.first_name || ''),
    rows,
    photo: true,
  };
}
