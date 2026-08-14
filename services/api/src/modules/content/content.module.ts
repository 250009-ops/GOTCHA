import { Module } from '@nestjs/common';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';
import { StreakService } from '../../services/streak.service';

@Module({
  controllers: [ContentController],
  providers: [ContentService, StreakService],
  exports: [ContentService],
})
export class ContentModule {}
