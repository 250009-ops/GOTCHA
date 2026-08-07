import { Controller, Get, Param, Put, Body, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthUserPayload } from '../../common/decorators';
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

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.content.getById(id);
  }

  @Get(':id/segments')
  segments(
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('limit') limit?: string,
  ) {
    return this.content.getSegments(id, Number(from ?? 0), Number(limit ?? 100));
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
