import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminRole, UserReportReason } from '@prisma/client';
import { IsBoolean, IsEnum, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { AuthUserPayload, CurrentUser, Roles } from '../../common/decorators';
import { RolesGuard } from '../../common/guards';
import { SafetyService } from './safety.service';

export class FriendRequestDto {
  @IsUUID() userId!: string;
}
export class RespondFriendDto {
  @IsBoolean() accept!: boolean;
}
export class ContentReportDto {
  @IsOptional() @IsUUID() contentId?: string;
  @IsOptional() @IsUUID() importId?: string;
  @IsEnum(UserReportReason) reason!: UserReportReason;
  @IsOptional() @IsString() @MaxLength(1000) details?: string;
}
export class ResolveReportDto {
  @IsIn(['reviewed', 'actioned', 'dismissed']) status!: 'reviewed' | 'actioned' | 'dismissed';
}
export class SetAiDisabledDto {
  @IsBoolean() aiDisabled!: boolean;
}

@ApiTags('safety')
@Controller()
export class SafetyController {
  constructor(private safety: SafetyService) {}

  @Get('friends')
  friends(@CurrentUser() u: AuthUserPayload) {
    return this.safety.listFriends(u.sub);
  }
  @Post('friends/requests')
  request(@CurrentUser() u: AuthUserPayload, @Body() dto: FriendRequestDto) {
    return this.safety.sendRequest(u.sub, dto.userId);
  }
  @Post('friends/requests/:id/respond')
  respond(@CurrentUser() u: AuthUserPayload, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RespondFriendDto) {
    return this.safety.respond(u.sub, id, dto.accept);
  }
  @Delete('friends/:userId')
  unfriend(@CurrentUser() u: AuthUserPayload, @Param('userId', ParseUUIDPipe) userId: string) {
    return this.safety.unfriend(u.sub, userId);
  }
  @Post('reports/content')
  reportContent(@CurrentUser() u: AuthUserPayload, @Body() dto: ContentReportDto) {
    return this.safety.reportContent(u.sub, dto);
  }

  // Admin moderation queue (user + content reports).
  @Get('admin/safety/reports')
  @UseGuards(RolesGuard)
  @Roles(AdminRole.superadmin, AdminRole.moderator)
  queue(@Query('kind') kind?: string, @Query('status') status?: string) {
    return this.safety.queue(kind === 'content' ? 'content' : 'user', status);
  }
  @Patch('admin/safety/reports/:kind/:id')
  @UseGuards(RolesGuard)
  @Roles(AdminRole.superadmin, AdminRole.moderator)
  resolve(
    @CurrentUser() u: AuthUserPayload,
    @Param('kind') kind: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveReportDto,
  ) {
    return this.safety.resolve(u.sub, kind === 'content' ? 'content' : 'user', id, dto.status);
  }
  // S7: support/admin can switch AI off (or back on) for one account.
  @Patch('admin/users/:id/ai')
  @UseGuards(RolesGuard)
  @Roles(AdminRole.superadmin, AdminRole.moderator)
  setAi(@CurrentUser() u: AuthUserPayload, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SetAiDisabledDto) {
    return this.safety.setAiDisabled(u.sub, id, dto.aiDisabled);
  }
}
