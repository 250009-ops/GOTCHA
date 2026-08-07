import { Controller, Get, Patch, Body } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthUserPayload } from '../../common/decorators';
import { UsersService } from './users.service';
import { UpdatePreferencesDto, UpdateProfileDto } from './dto/users.dto';

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

  @Patch('me')
  updateProfile(@CurrentUser() user: AuthUserPayload, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user.sub, dto);
  }

  @Patch('me/preferences')
  updatePreferences(@CurrentUser() user: AuthUserPayload, @Body() dto: UpdatePreferencesDto) {
    return this.users.updatePreferences(user.sub, dto);
  }
}
