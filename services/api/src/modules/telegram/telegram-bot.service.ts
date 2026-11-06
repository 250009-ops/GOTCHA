import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { logIncomingCustomEmoji } from './custom-emoji';
import { GrammySender } from './telegram-api';
import { registerTelegramWebhook } from './register-webhook';
import { TelegramLoginService } from './telegram-login.service';
import { handleTelegramUpdate, type TelegramUpdateBody } from './telegram-updates';

@Injectable()
export class TelegramBotService implements OnModuleInit {
  private readonly logger = new Logger('TelegramBot');

  constructor(
    private login: TelegramLoginService,
    private sender: GrammySender,
  ) {}

  async onModuleInit() {
    try {
      const result = await registerTelegramWebhook();
      if (result === 'registered') this.logger.log('telegram webhook registered');
    } catch {
      this.logger.warn('telegram webhook registration skipped');
    }
  }

  async handleUpdate(update: unknown) {
    logIncomingCustomEmoji(update);
    await handleTelegramUpdate(update as TelegramUpdateBody, this.login, async (message) => {
      const result = await this.sender.send(message.chatId, message.text, message.rows, message.photo, message.entities, message.replyKeyboard);
      if (result.status === 'blocked') {
        const user = await this.login.userByTelegram(BigInt(message.chatId));
        if (user) await this.login.markBlocked(user.id);
      }
    });
  }
}
