import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthUserPayload, Public } from '../../common/decorators';
import { BillingService } from './billing.service';

@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(private billing: BillingService) {}

  @Get('subscription')
  subscription(@CurrentUser() user: AuthUserPayload) {
    return this.billing.getSubscription(user.sub);
  }

  /** Raw plan rows — prefer `/marketing/plans` for Landing feature copy. */
  @Public()
  @Get('plans')
  plans() {
    return this.billing.listPlans();
  }
}
