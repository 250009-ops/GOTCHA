import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthUserPayload } from '../../common/decorators';
import { VocabularyService } from './vocabulary.service';
import {
  ReviewVocabularyDto,
  SaveVocabularyDto,
  UpdateVocabularyDto,
} from './dto/vocabulary.dto';

@ApiTags('vocabulary')
@Controller('vocabulary')
export class VocabularyController {
  constructor(private vocabulary: VocabularyService) {}

  @Get()
  list(@CurrentUser() user: AuthUserPayload, @Query('sort') sort?: string) {
    return this.vocabulary.list(user.sub, sort);
  }

  @Get('review-queue')
  reviewQueue(@CurrentUser() user: AuthUserPayload, @Query('limit') limit?: string) {
    return this.vocabulary.reviewQueue(user.sub, Number(limit ?? 20));
  }

  @Post()
  save(@CurrentUser() user: AuthUserPayload, @Body() dto: SaveVocabularyDto) {
    return this.vocabulary.save(user.sub, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateVocabularyDto,
  ) {
    return this.vocabulary.update(user.sub, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUserPayload, @Param('id') id: string) {
    return this.vocabulary.remove(user.sub, id);
  }

  @Post(':id/review')
  review(
    @CurrentUser() user: AuthUserPayload,
    @Param('id') id: string,
    @Body() dto: ReviewVocabularyDto,
  ) {
    return this.vocabulary.review(user.sub, id, dto);
  }
}
