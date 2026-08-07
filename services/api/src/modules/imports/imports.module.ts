import { Module } from '@nestjs/common';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';
import { LimitsService } from '../../services/limits.service';

@Module({
  controllers: [ImportsController],
  providers: [ImportsService, LimitsService],
})
export class ImportsModule {}