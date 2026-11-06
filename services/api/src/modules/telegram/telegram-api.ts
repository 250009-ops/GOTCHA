import { existsSync } from 'fs';
import { join } from 'path';
import { Bot, GrammyError, InlineKeyboard, InputFile } from 'grammy';
import { Logger } from '@nestjs/common';

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
  send(chatId: number | bigint, text: string, rows?: BotButton[][], photo?: boolean): Promise<SendResult>;
}

export function welcomeImagePath(): string | null {
  const candidates = [
    join(process.cwd(), 'assets', 'telegram', 'welcome-quietly.png'),
    join(__dirname, '../../../assets/telegram/welcome-quietly.png'),
    join(__dirname, '../../../../assets/telegram/welcome-quietly.png'),
  ];
  return candidates.find((path) => existsSync(path)) ?? null;
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

  async send(chatId: number | bigint, text: string, rows?: BotButton[][], photo?: boolean): Promise<SendResult> {
    const bot = this.client();
    if (!bot) return { status: 'failed' };
    const reply_markup = keyboard(rows);
    const id = Number(chatId);
    try {
      if (photo) {
        const file = welcomeImagePath();
        if (file) {
          await bot.api.sendPhoto(id, new InputFile(file), {
            caption: text,
            parse_mode: 'HTML',
            reply_markup,
          });
          return { status: 'ok' };
        }
      }
      await bot.api.sendMessage(id, text, { parse_mode: 'HTML', reply_markup });
      return { status: 'ok' };
    } catch (error) {
      const code = error instanceof GrammyError ? error.error_code : 0;
      if (code === 403) return { status: 'blocked' };
      this.logger.warn(`telegram send failed: ${code || 'error'}`);
      return { status: 'failed' };
    }
  }
}

export function miniAppUrl(path = ''): string {
  const base = (process.env.TELEGRAM_MINI_APP_URL || 'https://gotchaa.uz/learn/tg').replace(/\/$/, '');
  if (!path) return base;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export function miniAppStartUrl(startapp: string): string {
  return `${miniAppUrl()}?startapp=${encodeURIComponent(startapp)}`;
}

export function botDeepLink(payload: string): string {
  const username = (process.env.TELEGRAM_BOT_USERNAME || '').replace(/^@/, '').trim();
  return `https://t.me/${username}?start=${payload}`;
}

export function learnerForgotUrl(): string {
  const base = (process.env.LEARNER_APP_URL || 'https://gotchaa.uz/learn').replace(/\/$/, '');
  return `${base}/forgot-password`;
}
