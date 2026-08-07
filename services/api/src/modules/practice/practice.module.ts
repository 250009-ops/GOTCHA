import { Module } from '@nestjs/common';
import { PracticeController } from './practice.controller';
import { PracticeService } from './practice.service';
import { AiModule } from '../ai/ai.module';
import { LimitsService } from '../../services/limits.service';

@Module({
  imports: [AiModule],
  controllers: [PracticeController],
  providers: [PracticeService, LimitsService],
})
export class PracticeModule {}