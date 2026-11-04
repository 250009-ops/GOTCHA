import { Global, Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { isDevAuthEnabled } from '../common/dev-auth/dev-auth.config';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  dbAvailable = true;

  async onModuleInit() {
    try {
      await this.$connect();
    } catch (error) {
      if (isDevAuthEnabled()) {
        this.dbAvailable = false;
        this.logger.warn(
          'Database unavailable — API running with in-memory dev auth only (DEV_AUTH_ANY_CREDENTIAL=true).',
        );
        return;
      }
      throw error;
    }
  }

  async onModuleDestroy() {
    if (this.dbAvailable) {
      await this.$disconnect();
    }
  }
}
