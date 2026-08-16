import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthUserPayload } from '../../common/decorators';
import { AiService } from './ai.service';
import { LookupDto, TranslateDto } from './dto/ai.dto';

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
}
