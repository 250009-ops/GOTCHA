import { Module } from '@nestjs/common';
import { ReadingController } from './reading.controller';
import { ReadingService } from './reading.service';
import { StreakService } from '../../services/streak.service';

@Module({
  controllers: [ReadingController],
  providers: [ReadingService, StreakService],
  exports: [ReadingService],
})
export class ReadingModule {}
