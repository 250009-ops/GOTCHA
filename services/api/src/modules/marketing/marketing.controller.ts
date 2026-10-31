import { Controller, Get, Header, Query } from '@nestjs/common';
import { planLang } from './plan-copy';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators';
import { MarketingService } from './marketing.service';

@ApiTags('marketing')
@Controller('marketing')
export class MarketingController {
  constructor(private marketing: MarketingService) {}

  @Public()
  @Header('Cache-Control', 'no-store')
  @Get('stats')
  stats() {
    return this.marketing.stats();
  }

  @Public()
  @Get('plans')
  plans(@Query('lang') lang?: string) {
    return this.marketing.plans(planLang(lang));
  }

  @Public()
  @Header('Cache-Control', 'public, max-age=15')
  @Get('landing')
  landing() {
    return this.marketing.landing();
  }
}
