import { Controller, Get, GoneException, Header, Query } from '@nestjs/common';
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

  /** WLF-35 (Kai 6.1a): the old landing-content endpoint is retired. The new landing makes no API calls and the
   *  admin never used it; the learner login page now reads /marketing/stats only. 410 so caches/CDNs drop it. */
  @Public()
  @Header('Cache-Control', 'no-store')
  @Get('landing')
  landing(): never {
    throw new GoneException({ code: 'endpoint_retired', message: 'GET /marketing/landing was retired in final-6.1; use /marketing/stats and /marketing/plans.' });
  }
}
