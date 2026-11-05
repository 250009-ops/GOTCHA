import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { DevAuthModule } from './common/dev-auth/dev-auth.module';
import { clientIp } from './common/runtime-security';
import { MailModule } from './common/mail/mail.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ContentModule } from './modules/content/content.module';
import { VocabularyModule } from './modules/vocabulary/vocabulary.module';
import { PracticeModule } from './modules/practice/practice.module';
import { AiModule } from './modules/ai/ai.module';
import { BillingModule } from './modules/billing/billing.module';
import { ImportsModule } from './modules/imports/imports.module';
import { AdminModule } from './modules/admin/admin.module';
import { SafetyModule } from './modules/safety/safety.module';
import { ReadingModule } from './modules/reading/reading.module';
import { MarketingModule } from './modules/marketing/marketing.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { TelegramModule } from './modules/telegram/telegram.module';
import { ReferralsModule } from './modules/referrals/referrals.module';

import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        join(process.cwd(), '.env'),
        join(process.cwd(), '../../.env'),
      ],
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 100 }],
      getTracker: (req) => clientIp(req),
    }),
    DevAuthModule,
    MailModule,
    PrismaModule,
    AuthModule,
    UsersModule,
    ContentModule,
    ReadingModule,
    VocabularyModule,
    PracticeModule,
    AiModule,
    BillingModule,
    ImportsModule,
    AdminModule,
    SafetyModule,
    MarketingModule,
    MessagingModule,
    NotificationsModule,
    TelegramModule,
    ReferralsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
