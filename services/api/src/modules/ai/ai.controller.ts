import { Body, Controller, Header, Post, StreamableFile } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
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

  @Post('translate')
  translate(@CurrentUser() user: AuthUserPayload, @Body() dto: TranslateDto) {
    return this.ai.translate(user.sub, dto);
  }

  @Post('speech')
  @Header('Content-Type', 'audio/mpeg')
  @Header('Cache-Control', 'private, max-age=86400')
  async speech(@CurrentUser() _user: AuthUserPayload, @Body() dto: SpeechDto) {
    const buffer = await this.ai.speak(dto.text, dto.lang);
    return new StreamableFile(buffer, {
      type: 'audio/mpeg',
      disposition: 'inline',
    });
  }
}
