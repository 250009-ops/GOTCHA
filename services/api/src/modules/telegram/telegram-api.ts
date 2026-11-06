import { existsSync } from 'fs';
import { join } from 'path';
import { Bot, GrammyError, InlineKeyboard, InputFile } from 'grammy';
import { Logger } from '@nestjs/common';
import type { BotEntity } from './custom-emoji';

export interface BotButton {
  text: string;
  webApp?: string;
  url?: string;
  callback?: string;
}

export interface SendResult {
  status: 'ok' | 'blocked' | 'failed';
}

export interface TelegramSender {
  send(chatId: number | bigint, text: string, rows?: BotButton[][], photo?: boolean, entities?: BotEntity[], replyKeyboard?: string[][]): Promise<SendResult>;
}

export function welcomeImagePath(): string | null {
  const candidates = [
    join(process.cwd(), 'assets', 'telegram', 'welcome-quietly.png'),
    join(__dirname, '../../../assets/telegram/welcome-quietly.png'),
    join(__dirname, '../../../../assets/telegram/welcome-quietly.png'),
  ];
  return candidates.find((path) => existsSync(path)) ?? null;
}

export function replyKeyboardMarkup(rows: string[][] | undefined) {
  if (!rows?.length) return undefined;
  return {
    keyboard: rows.map((row) => row.map((text) => ({ text }))),
    resize_keyboard: true,
    is_persistent: true,
  };
}

export function keyboard(rows: BotButton[][] | undefined): InlineKeyboard | undefined {
  if (!rows?.length) return undefined;
  const kb = new InlineKeyboard();
  rows.forEach((row, index) => {
    if (index > 0) kb.row();
    for (const button of row) {
      if (button.webApp) kb.webApp(button.text, button.webApp);
      else if (button.url) kb.url(button.text, button.url);
      else if (button.callback) kb.text(button.text, button.callback);
    }
  });
  return kb;
}

/** grammY client. Never logs the token, the message text, or the chat id. */
export class GrammySender implements TelegramSender {
  private readonly logger = new Logger('Telegram');
  private bot: Bot | null = null;

  constructor(private readonly token = process.env.TELEGRAM_BOT_TOKEN?.trim() ?? '') {}

  client(): Bot | null {
    if (!this.token) return null;
    if (!this.bot) this.bot = new Bot(this.token);
    return this.bot;
  }

  async send(
    chatId: number | bigint,
    text: string,
    rows?: BotButton[][],
    photo?: boolean,
    entities?: BotEntity[],
    replyKeyboard?: string[][],
  ): Promise<SendResult> {
    const bot = this.client();
    if (!bot) return { status: 'failed' };
    const reply_markup = keyboard(rows) ?? replyKeyboardMarkup(replyKeyboard);
    const id = Number(chatId);
    const markup = entities?.length
      ? { reply_markup, entities }
      : { reply_markup, parse_mode: 'HTML' as const };
    try {
      if (photo) {
        const file = welcomeImagePath();
        if (file) {
          const caption = entities?.length
            ? { caption: text, caption_entities: entities, reply_markup }
            : { caption: text, parse_mode: 'HTML' as const, reply_markup };
          await bot.api.sendPhoto(id, new InputFile(file), caption);
          return { status: 'ok' };
        }
      }
      await bot.api.sendMessage(id, text, markup);
      return { status: 'ok' };
    } catch (error) {
      const code = error instanceof GrammyError ? error.error_code : 0;
      if (code === 403) return { status: 'blocked' };
      this.logger.warn(`telegram send failed: ${code || 'error'}`);
      return { status: 'failed' };
    }
  }
}

export function miniAppUrl(path = '', lang?: string): string {
  const base = (process.env.TELEGRAM_MINI_APP_URL || 'https://gotchaa.uz/learn/tg').replace(/\/$/, '');
  const url = !path ? base : `${base}${path.startsWith('/') ? path : `/${path}`}`;
  if (!lang) return url;
  return `${url}${url.includes('?') ? '&' : '?'}lang=${encodeURIComponent(lang)}`;
}

export function miniAppStartUrl(startapp: string, lang?: string): string {
  const url = `${miniAppUrl()}?startapp=${encodeURIComponent(startapp)}`;
  return lang ? `${url}&lang=${encodeURIComponent(lang)}` : url;
}

export function botDeepLink(payload: string): string {
  const username = (process.env.TELEGRAM_BOT_USERNAME || '').replace(/^@/, '').trim();
  return `https://t.me/${username}?start=${payload}`;
}

export function learnerForgotUrl(): string {
  const base = (process.env.LEARNER_APP_URL || 'https://gotchaa.uz/learn').replace(/\/$/, '');
  return `${base}/forgot-password`;
}
