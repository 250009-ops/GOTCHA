import { Controller, Get, Param, Put, Body, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthUserPayload, Public } from '../../common/decorators';
import { UuidOr404Pipe } from '../../common/pipes/uuid-or-404.pipe';
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
  list(@CurrentUser() user: AuthUserPayload, @Query() query: ContentQueryDto) {
    return this.content.list(query, user.sub, user.isAdmin);
  }

  /** Enabled languages for learner UI (admin LanguageCatalog toggles). */
  @Public()
  @Get('languages')
  languages() {
    return this.content.listLanguages();
  }

  /**
   * DevOps 31 Oct: /content/home and /content/search fell into `:id` → 500. Static routes are declared
   * before `:id` (Nest matches in order) and `:id` only accepts UUIDs (else 404).
   */
  @Get('home')
  home(@CurrentUser() user: AuthUserPayload, @Query('targetLang') targetLang?: string) {
    return this.content.getFeed(user.sub, targetLang);
  }

  @Get('search')
  search(@CurrentUser() user: AuthUserPayload, @Query() query: ContentQueryDto) {
    return this.content.list(query, user.sub, user.isAdmin);
  }

  @Get(':id')
  getById(@CurrentUser() user: AuthUserPayload, @Param('id', UuidOr404Pipe) id: string) {
    return this.content.getById(id, user.sub, user.isAdmin);
  }

  @Get(':id/segments')
  segments(
    @CurrentUser() user: AuthUserPayload,
    @Param('id', UuidOr404Pipe) id: string,
    @Query('from') from?: string,
    @Query('limit') limit?: string,
  ) {
    return this.content.getSegments(id, Number(from ?? 0), Number(limit ?? 100), user.sub, user.isAdmin);
  }

  @Put(':id/progress')
  progress(
    @CurrentUser() user: AuthUserPayload,
    @Param('id', UuidOr404Pipe) id: string,
    @Body() dto: UpdateProgressDto,
  ) {
    return this.content.updateProgress(user.sub, id, dto, user.isAdmin);
  }
}
