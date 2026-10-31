import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { CurrentUser, AuthUserPayload } from '../../common/decorators';
import { ImportsService } from './imports.service';
import { ImportFileDto, ImportPasteDto, ImportUrlDto } from './dto/imports.dto';
import { MAX_FILE_BYTES } from './extract-text';

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

  @Post('inspect')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_BYTES },
    }),
  )
  inspect(@CurrentUser() user: AuthUserPayload, @UploadedFile() file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException('File is required');
    return this.imports.inspectFile(user.sub, file);
  }

  @Post('file')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        title: { type: 'string' },
        language: { type: 'string' },
        paymentId: { type: 'string', format: 'uuid' },
        uploadId: { type: 'string', format: 'uuid', description: 'From POST /imports/inspect; replaces file' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_BYTES },
    }),
  )
  file(
    @CurrentUser() user: AuthUserPayload,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: ImportFileDto,
  ) {
    if (!file && !dto.uploadId) throw new BadRequestException('File or uploadId is required');
    return this.imports.importFile(user.sub, file, dto);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.imports.get(user.sub, id);
  }

  /** Re-queue a failed import from its stored source. Never charges again. */
  @Post(':id/retry')
  retry(@CurrentUser() user: AuthUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.imports.retry(user.sub, id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUserPayload, @Param('id') id: string) {
    return this.imports.remove(user.sub, id);
  }
}
