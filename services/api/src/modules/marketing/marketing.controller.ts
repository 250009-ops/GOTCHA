import { Controller, Get, Header } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators';
import { MarketingService } from './marketing.service';

@ApiTags('marketing')
@Controller('marketing')
export class MarketingController {
  constructor(private marketing: MarketingService) {}

  @Public()
  @Get('stats')
  stats() {
    return this.marketing.stats();
  }

  @Public()
  @Get('plans')
  plans() {
    return this.marketing.plans();
  }

  @Public()
  @Header('Cache-Control', 'public, max-age=30, stale-while-revalidate=120')
  @Get('landing')
  landing() {
    return this.marketing.landing();
  }
}
