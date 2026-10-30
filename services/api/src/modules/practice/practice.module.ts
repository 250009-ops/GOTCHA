import { Module } from '@nestjs/common';
import { PracticeController } from './practice.controller';
import { PracticeService } from './practice.service';
import { AiModule } from '../ai/ai.module';
import { LimitsService } from '../../services/limits.service';
import { VocabularyModule } from '../vocabulary/vocabulary.module';
import { PracticeEngineService } from './practice-engine.service';

@Module({
  imports: [AiModule, VocabularyModule],
  controllers: [PracticeController],
  providers: [PracticeService, PracticeEngineService, LimitsService],
})
export class PracticeModule {}