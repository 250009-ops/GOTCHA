import { Module } from '@nestjs/common';
import { GrammySender } from './telegram-api';
import { TelegramBotService } from './telegram-bot.service';
import { TelegramController } from './telegram.controller';
import { TelegramLoginService } from './telegram-login.service';
import { TelegramNotifyService } from './telegram-notify.service';

@Module({
  controllers: [TelegramController],
  providers: [GrammySender, TelegramLoginService, TelegramNotifyService, TelegramBotService],
  exports: [TelegramLoginService, TelegramNotifyService, GrammySender],
})
export class TelegramModule {}
