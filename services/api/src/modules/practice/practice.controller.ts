import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Post, Query, StreamableFile } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthUserPayload } from '../../common/decorators';
import { PracticeService } from './practice.service';
import { StartPracticeDto, SubmitPracticeDto } from './dto/practice.dto';
import { PracticeEngineService } from './practice-engine.service';
import { AnswerExerciseDto, AudioDto, DailySessionQueryDto } from './dto/practice-engine.dto';

@ApiTags('practice')
@Controller('practice')
export class PracticeController {
  constructor(
    private practice: PracticeService,
    private engine: PracticeEngineService,
  ) {}

  /** Due/new counts, XP vs daily goal, streak + freezes, accuracy and 7-day forecast. */
  @Get('overview')
  overview(@CurrentUser() user: AuthUserPayload, @Query('lang') lang?: string) {
    return this.engine.overview(user.sub, lang);
  }

  @Get('forecast')
  forecast(@CurrentUser() user: AuthUserPayload, @Query('lang') lang?: string) {
    return this.engine.forecast(user.sub, lang);
  }

  /** "Practice my words": mixed adaptive session from the learner's deck. No chapter needed. */
  @Get('daily')
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  daily(@CurrentUser() user: AuthUserPayload, @Query() q: DailySessionQueryDto) {
    return this.engine.dailySession(user.sub, q);
  }

  /** Server-side grading → FSRS → ReviewLog → XP / goal / streak. */
  @Post('answer')
  answer(@CurrentUser() user: AuthUserPayload, @Body() dto: AnswerExerciseDto) {
    return this.engine.answer(user.sub, dto);
  }

  /** Item audio (TTS) by vocab id, so listening items never carry their text. */
  @Post('audio')
  @Header('Content-Type', 'audio/mpeg')
  @Header('Cache-Control', 'private, max-age=86400')
  async audio(@CurrentUser() user: AuthUserPayload, @Body() dto: AudioDto) {
    return new StreamableFile(await this.engine.audio(user.sub, dto.vocabId), { type: 'audio/mpeg', disposition: 'inline' });
  }

  @Post('daily/:id/complete')
  complete(@CurrentUser() user: AuthUserPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.engine.complete(user.sub, id);
  }

  @Post('sessions')
  start(@CurrentUser() user: AuthUserPayload, @Body() dto: StartPracticeDto) {
    return this.practice.startSession(user.sub, dto);
  }

  @Post('sessions/:id/answers')
  submit(
    @CurrentUser() user: AuthUserPayload,
    @Param('id') id: string,
    @Body() dto: SubmitPracticeDto,
  ) {
    return this.practice.submitAnswers(user.sub, id, dto);
  }

  @Get('sessions/:id')
  getSession(@CurrentUser() user: AuthUserPayload, @Param('id') id: string) {
    return this.practice.getSession(user.sub, id);
  }
}
