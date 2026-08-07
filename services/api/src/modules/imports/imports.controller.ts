import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthUserPayload } from '../../common/decorators';
import { ImportsService } from './imports.service';
import { ImportPasteDto, ImportUrlDto } from './dto/imports.dto';

@ApiTags('imports')
@Controller('imports')
export class ImportsController {
  constructor(private imports: ImportsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUserPayload,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.imports.list(user.sub, Number(page ?? 1), Number(pageSize ?? 20));
  }

  @Post('paste')
  paste(@CurrentUser() user: AuthUserPayload, @Body() dto: ImportPasteDto) {
    return this.imports.importPaste(user.sub, dto);
  }

  @Post('url')
  url(@CurrentUser() user: AuthUserPayload, @Body() dto: ImportUrlDto) {
    return this.imports.importUrl(user.sub, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUserPayload, @Param('id') id: string) {
    return this.imports.remove(user.sub, id);
  }
}
