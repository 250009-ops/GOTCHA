import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthUserPayload } from '../../common/decorators';
import { UsersService } from './users.service';
import {
  AddTargetLanguageDto,
  ChangePasswordDto,
  DeleteAccountDto,
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

  @Patch('me')
  updateProfile(@CurrentUser() user: AuthUserPayload, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user.sub, dto);
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
