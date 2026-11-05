import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReferralService } from './referral.service';
import { ReferralsController } from './referrals.controller';

@Module({
  imports: [NotificationsModule],
  controllers: [ReferralsController],
  providers: [ReferralService],
  exports: [ReferralService],
})
export class ReferralsModule {}
