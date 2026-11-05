import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthUserPayload, CurrentUser, Public } from '../../common/decorators';
import { ReferralService } from './referral.service';

@ApiTags('referrals')
@Controller('referrals')
export class ReferralsController {
  constructor(private referrals: ReferralService) {}

  @Get('me')
  me(@CurrentUser() user: AuthUserPayload) {
    return this.referrals.me(user.sub);
  }

  @Public()
  @Get('resolve/:code')
  resolve(@Param('code') code: string) {
    return this.referrals.resolve(code);
  }
}
