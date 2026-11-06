import { Injectable } from '@nestjs/common';
import { normalizeNotificationLocale } from '@gotcha/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { applyCustomEmoji, notificationEmojiKeys } from './custom-emoji';
import { botButtons, botLocale, notificationButton, notificationHtml, notificationStartApp } from './copy';
import { tashkentDayStart } from '../../common/tashkent-window';
import { inTelegramQuietHours, TELEGRAM_DAILY_LIMIT } from './quiet';
import { GrammySender, miniAppStartUrl } from './telegram-api';

const BOT_KINDS = new Set(['content', 'goal', 'vocab', 'message', 'streak']);

@Injectable()
export class TelegramNotifyService {
  constructor(
    private prisma: PrismaService,
    private sender: GrammySender,
  ) {}

  /**
   * Sends one notification through the bot when the user has a linked Telegram account
   * and notifications are on. At most 3 a day, never between 22:00 and 08:00 Asia/Tashkent.
   * A 403 stops further sends until the user messages the bot again.
   */
  async send(userId: string, item: { kind: string; title: string; body: string; refId?: string | null }): Promise<boolean> {
    if (!BOT_KINDS.has(item.kind)) return false;
    if (inTelegramQuietHours()) return false;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        telegramId: true,
        telegramBotBlockedAt: true,
        uiLanguage: true,
        preferences: { select: { notificationsEnabled: true } },
      },
    });
    if (!user?.telegramId || user.telegramBotBlockedAt) return false;
    if (user.preferences?.notificationsEnabled === false) return false;
    const since = tashkentDayStart();
    const sentToday = await this.prisma.telegramOutboundLog.count({
      where: { userId, createdAt: { gte: since } },
    });
    if (sentToday >= TELEGRAM_DAILY_LIMIT) return false;
    const locale = botLocale(normalizeNotificationLocale(user.uiLanguage));
    const button = notificationButton(locale, item.kind) ?? { text: botButtons(locale).open, startapp: 'open' };
    const startapp = item.kind === 'content' || item.kind === 'message'
      ? notificationStartApp(item.kind, item.refId)
      : notificationStartApp(item.kind);
    const prepared = applyCustomEmoji(notificationHtml(item.kind, item.title, item.body), notificationEmojiKeys(item.kind));
    const result = await this.sender.send(user.telegramId, prepared.text, [[
      { text: button.text, webApp: miniAppStartUrl(startapp, locale) },
    ]], undefined, prepared.entities);
    if (result.status === 'blocked') {
      await this.prisma.user.update({ where: { id: userId }, data: { telegramBotBlockedAt: new Date() } });
      return false;
    }
    if (result.status !== 'ok') return false;
    await this.prisma.telegramOutboundLog.create({ data: { userId, kind: item.kind } });
    return true;
  }
}
