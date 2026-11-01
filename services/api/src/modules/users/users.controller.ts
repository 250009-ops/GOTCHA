import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { CurrentUser, AuthUserPayload } from '../../common/decorators';
import { UsersService } from './users.service';
import {
  AddTargetLanguageDto,
  ChangePasswordDto,
  DeleteAccountDto,
  SetAgeDto, SetAiPreferenceDto,
  UpdatePreferencesDto,
  UpdateProfileDto,
  UpdateTargetLanguageDto,
} from './dto/users.dto';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private users: UsersService) {}

  @Get('me')
  me(@CurrentUser() user: AuthUserPayload) {
    return this.users.getProfile(user.sub);
  }

  @Get('me/stats')
  stats(@CurrentUser() user: AuthUserPayload) {
    return this.users.getStats(user.sub);
  }

  @Get('me/export')
  exportData(@CurrentUser() user: AuthUserPayload) {
    return this.users.exportData(user.sub);
  }

  /** W-12 one-time age prompt (also "prefer not to say"). */
  @Post('me/age')
  setAge(@CurrentUser() user: AuthUserPayload, @Body() dto: SetAgeDto) {
    return this.users.setAge(user.sub, dto.birthYear);
  }

  /** Learner AI-off switch (Settings). Same per-account flag support uses. */
  @Patch('me/ai')
  setAi(@CurrentUser() user: AuthUserPayload, @Body() dto: SetAiPreferenceDto) {
    return this.users.setAiPreference(user.sub, dto.aiDisabled);
  }

  @Patch('me')
  updateProfile(@CurrentUser() user: AuthUserPayload, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user.sub, dto);
  }

  @Post('me/avatar')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  uploadAvatar(
    @CurrentUser() user: AuthUserPayload,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) throw new BadRequestException('File is required');
    return this.users.uploadAvatar(user.sub, file);
  }

  @Delete('me/avatar')
  removeAvatar(@CurrentUser() user: AuthUserPayload) {
    return this.users.removeAvatar(user.sub);
  }

  @Patch('me/preferences')
  updatePreferences(@CurrentUser() user: AuthUserPayload, @Body() dto: UpdatePreferencesDto) {
    return this.users.updatePreferences(user.sub, dto);
  }

  /** Authenticated change-password — usable by learners and admins alike (no SMTP dependency). */
  @Patch('me/password')
  changePassword(@CurrentUser() user: AuthUserPayload, @Body() dto: ChangePasswordDto) {
    return this.users.changePassword(user.sub, dto);
  }

  @Post('me/target-languages')
  addTargetLanguage(@CurrentUser() user: AuthUserPayload, @Body() dto: AddTargetLanguageDto) {
    return this.users.addTargetLanguage(user.sub, dto);
  }

  @Patch('me/target-languages/:lang')
  updateTargetLanguage(
    @CurrentUser() user: AuthUserPayload,
    @Param('lang') lang: string,
    @Body() dto: UpdateTargetLanguageDto,
  ) {
    return this.users.updateTargetLanguage(user.sub, lang, dto);
  }

  @Delete('me/target-languages/:lang')
  removeTargetLanguage(@CurrentUser() user: AuthUserPayload, @Param('lang') lang: string) {
    return this.users.removeTargetLanguage(user.sub, lang);
  }

  @Delete('me')
  deleteAccount(@CurrentUser() user: AuthUserPayload, @Body() dto: DeleteAccountDto) {
    return this.users.deleteAccount(user.sub, dto);
  }
}
