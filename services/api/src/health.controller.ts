import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators';

/** WL4-01: liveness for the boot smoke test and uptime checks. No DB call, no secrets. */
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  health() {
    return { ok: true };
  }
}
