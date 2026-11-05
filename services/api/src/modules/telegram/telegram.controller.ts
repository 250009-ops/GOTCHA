import { Body, Controller, Headers, HttpCode, Post, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { Public } from '../../common/decorators';
import { TelegramBotService } from './telegram-bot.service';

export function webhookSecretOk(header: string | undefined, expected: string | undefined): boolean {
  const want = expected?.trim() ?? '';
  const got = header?.trim() ?? '';
  if (!want || !got) return false;
  const left = Buffer.from(got);
  const right = Buffer.from(want);
  return left.length === right.length && timingSafeEqual(left, right);
}

@Controller('telegram')
export class TelegramController {
  constructor(private bot: TelegramBotService) {}

  @Public()
  @Post('webhook')
  @HttpCode(200)
  async webhook(
    @Headers('x-telegram-bot-api-secret-token') secret: string | undefined,
    @Body() update: unknown,
  ) {
    if (!webhookSecretOk(secret, process.env.TELEGRAM_WEBHOOK_SECRET)) {
      throw new UnauthorizedException();
    }
    await this.bot.handleUpdate(update);
    return { ok: true };
  }
}
