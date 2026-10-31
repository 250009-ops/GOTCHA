import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthUserPayload } from '../../common/decorators';
import { PracticeService } from './practice.service';
import { StartPracticeDto, SubmitPracticeDto } from './dto/practice.dto';

@ApiTags('practice')
@Controller('practice')
export class PracticeController {
  constructor(private practice: PracticeService) {}

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
