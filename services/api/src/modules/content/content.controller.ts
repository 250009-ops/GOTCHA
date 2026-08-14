import { Controller, Get, Param, Put, Body, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthUserPayload, Public } from '../../common/decorators';
import { ContentService } from './content.service';
import { ContentQueryDto, UpdateProgressDto } from './dto/content.dto';

@ApiTags('content')
@Controller('content')
export class ContentController {
  constructor(private content: ContentService) {}

  @Get('feed')
  feed(@CurrentUser() user: AuthUserPayload, @Query('targetLang') targetLang?: string) {
    return this.content.getFeed(user.sub, targetLang);
  }

  @Get()
  list(@Query() query: ContentQueryDto) {
    return this.content.list(query);
  }

  /** Enabled languages for learner UI (admin LanguageCatalog toggles). */
  @Public()
  @Get('languages')
  languages() {
    return this.content.listLanguages();
  }

  @Get(':id')
  getById(@CurrentUser() user: AuthUserPayload, @Param('id') id: string) {
    return this.content.getById(id, user.sub);
  }

  @Get(':id/segments')
  segments(
    @CurrentUser() user: AuthUserPayload,
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('limit') limit?: string,
  ) {
    return this.content.getSegments(id, Number(from ?? 0), Number(limit ?? 100), user.sub);
  }

  @Put(':id/progress')
  progress(
    @CurrentUser() user: AuthUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateProgressDto,
  ) {
    return this.content.updateProgress(user.sub, id, dto);
  }
}
