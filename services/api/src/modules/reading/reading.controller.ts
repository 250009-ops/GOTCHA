import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthUserPayload } from '../../common/decorators';
import { ReadingService } from './reading.service';
import { EndSessionDto, MarkLemmaDto, StartSessionDto, UpdateProgressDto } from './dto/reading.dto';

@ApiTags('reading')
@Controller('reading')
export class ReadingController {
  constructor(private reading: ReadingService) {}

  @Post('sessions')
  start(@CurrentUser() user: AuthUserPayload, @Body() dto: StartSessionDto) {
    return this.reading.startSession(user.sub, dto);
  }

  @Put('sessions/:id/end')
  end(
    @CurrentUser() user: AuthUserPayload,
    @Param('id') id: string,
    @Body() dto: EndSessionDto,
  ) {
    return this.reading.endSession(user.sub, id, dto);
  }

  @Get('known-words')
  knownWords(@CurrentUser() user: AuthUserPayload) {
    return this.reading.getKnownWords(user.sub);
  }

  @Put('known-words')
  markLemma(@CurrentUser() user: AuthUserPayload, @Body() dto: MarkLemmaDto) {
    return this.reading.markLemma(user.sub, dto.lemma, dto.sourceLang, dto.status);
  }

  @Put('progress/:contentId')
  progress(
    @CurrentUser() user: AuthUserPayload,
    @Param('contentId') contentId: string,
    @Body() dto: UpdateProgressDto,
  ) {
    return this.reading.updateProgress(user.sub, contentId, dto);
  }
}
