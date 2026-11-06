import { Body, Controller, Header, HttpException, Post, Res, StreamableFile } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser, AuthUserPayload } from '../../common/decorators';
import { AiService } from './ai.service';
import { LookupDto, SpeechDto, TranslateDto } from './dto/ai.dto';

@ApiTags('ai')
@Controller('ai')
export class AiController {
  constructor(private ai: AiService) {}

  @Post('lookup')
  lookup(@CurrentUser() user: AuthUserPayload, @Body() dto: LookupDto) {
    return this.ai.lookup(user.sub, dto);
  }

  /** Deltas, then one sanitized result. nginx must not buffer this (X-Accel-Buffering). */
  @Post('lookup/stream')
  async lookupStream(@CurrentUser() user: AuthUserPayload, @Body() dto: LookupDto, @Res() res: Response) {
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    try {
      await this.ai.lookup(user.sub, { ...dto, stream: true }, (event, data) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      });
    } catch (err) {
      const status = err instanceof HttpException ? err.getStatus() : 503;
      const body = err instanceof HttpException ? err.getResponse() : { message: 'lookup failed' };
      res.write(`event: error\ndata: ${JSON.stringify({ status, body })}\n\n`);
    }
    res.end();
  }

  @Post('translate')
  translate(@CurrentUser() user: AuthUserPayload, @Body() dto: TranslateDto) {
    return this.ai.translate(user.sub, dto);
  }

  @Post('speech')
  @Header('Content-Type', 'audio/mpeg')
  @Header('Cache-Control', 'private, max-age=86400')
  async speech(@CurrentUser() user: AuthUserPayload, @Body() dto: SpeechDto) {
    const buffer = await this.ai.speak(dto.text, dto.lang, user.sub);
    return new StreamableFile(buffer, {
      type: 'audio/mpeg',
      disposition: 'inline',
    });
  }
}
