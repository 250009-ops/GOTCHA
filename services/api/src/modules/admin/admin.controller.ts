import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminRole, LicenseStatus, ModerationStatus, PublishStatus } from '@prisma/client';
import { CurrentUser, AuthUserPayload, Roles } from '../../common/decorators';
import { RolesGuard } from '../../common/guards';
import { AdminService } from './admin.service';

@ApiTags('admin')
@Controller('admin')
@UseGuards(RolesGuard)
export class AdminController {
  constructor(private admin: AdminService) {}

  @Get('me')
  @Roles(AdminRole.superadmin, AdminRole.analyst, AdminRole.editor, AdminRole.moderator)
  me(@CurrentUser() user: AuthUserPayload) {
    return this.admin.me(user.sub);
  }

  @Get('dashboard')
  @Roles(AdminRole.superadmin, AdminRole.analyst, AdminRole.editor)
  dashboard() {
    return this.admin.dashboard();
  }

  @Get('users')
  @Roles(AdminRole.superadmin, AdminRole.analyst, AdminRole.moderator)
  users(@Query('q') q?: string, @Query('tier') tier?: string) {
    return this.admin.listUsers(q, tier);
  }

  @Patch('users/:id')
  @Roles(AdminRole.superadmin)
  updateUser(@Param('id') id: string, @Body() body: { displayName?: string; deleted?: boolean }) {
    return this.admin.updateUser(id, body);
  }

  @Get('content')
  @Roles(AdminRole.superadmin, AdminRole.editor)
  content(@Query('status') status?: PublishStatus) {
    return this.admin.listContent(status);
  }

  @Get('content/curriculum')
  @Roles(AdminRole.superadmin, AdminRole.editor, AdminRole.analyst)
  curriculum(@Query('type') type?: string) {
    return this.admin.listCurriculum(type);
  }

  @Get('content/stats')
  @Roles(AdminRole.superadmin, AdminRole.editor, AdminRole.analyst)
  contentStats() {
    return this.admin.contentStats();
  }

  @Post('content')
  @Roles(AdminRole.superadmin, AdminRole.editor)
  createContent(@CurrentUser() user: AuthUserPayload, @Body() body: Record<string, unknown>) {
    return this.admin.createContent(user.sub, body);
  }

  @Patch('content/:id/publish')
  @Roles(AdminRole.superadmin, AdminRole.editor)
  publish(@Param('id') id: string) {
    return this.admin.publishContent(id);
  }

  @Patch('content/:id/archive')
  @Roles(AdminRole.superadmin, AdminRole.editor)
  archive(@Param('id') id: string) {
    return this.admin.archiveContent(id);
  }

  @Get('licenses')
  @Roles(AdminRole.superadmin, AdminRole.editor)
  licenses(@Query('status') status?: LicenseStatus) {
    return this.admin.listLicenses(status);
  }

  @Post('licenses')
  @Roles(AdminRole.superadmin, AdminRole.editor)
  createLicense(@CurrentUser() user: AuthUserPayload, @Body() body: Record<string, unknown>) {
    return this.admin.createLicense(user.sub, body);
  }

  @Get('moderation')
  @Roles(AdminRole.superadmin, AdminRole.moderator)
  moderation(@Query('status') status: ModerationStatus = ModerationStatus.pending) {
    return this.admin.listModeration(status);
  }

  @Patch('moderation/:id')
  @Roles(AdminRole.superadmin, AdminRole.moderator)
  reviewModeration(
    @CurrentUser() user: AuthUserPayload,
    @Param('id') id: string,
    @Body() body: { status: ModerationStatus; notes?: string },
  ) {
    return this.admin.reviewModeration(user.sub, id, body.status, body.notes);
  }

  @Get('ingestion')
  @Roles(AdminRole.superadmin, AdminRole.editor)
  ingestion() {
    return this.admin.listIngestionJobs();
  }

  @Get('search')
  @Roles(AdminRole.superadmin, AdminRole.analyst, AdminRole.editor, AdminRole.moderator)
  search(@Query('q') q?: string) {
    return this.admin.search(q);
  }

  @Get('subscriptions')
  @Roles(AdminRole.superadmin, AdminRole.analyst)
  subscriptions(@Query('range') range?: string) {
    return this.admin.subscriptions(range);
  }

  @Get('ai-usage')
  @Roles(AdminRole.superadmin, AdminRole.analyst, AdminRole.editor)
  aiUsage(@Query('range') range?: string) {
    return this.admin.aiUsage(range);
  }

  @Get('analytics')
  @Roles(AdminRole.superadmin, AdminRole.analyst)
  analytics(@Query('range') range?: string) {
    return this.admin.analytics(range);
  }

  @Get('languages')
  @Roles(AdminRole.superadmin, AdminRole.editor, AdminRole.analyst)
  languages() {
    return this.admin.languages();
  }

  @Patch('languages/:code')
  @Roles(AdminRole.superadmin, AdminRole.editor)
  updateLanguage(@Param('code') code: string, @Body() body: { isEnabled?: boolean }) {
    return this.admin.updateLanguage(code, body);
  }

  @Get('level-tests')
  @Roles(AdminRole.superadmin, AdminRole.editor, AdminRole.analyst)
  levelTests() {
    return this.admin.levelTests();
  }

  @Get('gamification')
  @Roles(AdminRole.superadmin, AdminRole.editor, AdminRole.analyst)
  gamification() {
    return this.admin.gamification();
  }

  @Post('gamification/achievements')
  @Roles(AdminRole.superadmin, AdminRole.editor)
  createAchievement(@Body() body: Record<string, unknown>) {
    return this.admin.createAchievement(body);
  }

  @Patch('gamification/achievements/:id')
  @Roles(AdminRole.superadmin, AdminRole.editor)
  updateAchievement(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.admin.updateAchievement(id, body);
  }

  @Get('notifications/feed')
  @Roles(AdminRole.superadmin, AdminRole.editor, AdminRole.analyst, AdminRole.moderator)
  notificationsFeed() {
    return this.admin.notificationsFeed();
  }

  @Get('notifications')
  @Roles(AdminRole.superadmin, AdminRole.editor)
  notifications() {
    return this.admin.notifications();
  }

  @Post('notifications')
  @Roles(AdminRole.superadmin, AdminRole.editor)
  createCampaign(@CurrentUser() user: AuthUserPayload, @Body() body: Record<string, unknown>) {
    return this.admin.createCampaign(user.sub, body);
  }

  @Patch('notifications/:id')
  @Roles(AdminRole.superadmin, AdminRole.editor)
  updateCampaign(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.admin.updateCampaign(id, body);
  }

  @Get('support')
  @Roles(AdminRole.superadmin, AdminRole.moderator)
  support() {
    return this.admin.support();
  }

  @Post('support')
  @Roles(AdminRole.superadmin, AdminRole.moderator)
  createTicket(@Body() body: Record<string, unknown>) {
    return this.admin.createTicket(body);
  }

  @Patch('support/:id')
  @Roles(AdminRole.superadmin, AdminRole.moderator)
  updateTicket(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.admin.updateTicket(id, body);
  }

  @Get('settings')
  @Roles(AdminRole.superadmin)
  settings() {
    return this.admin.settings();
  }

  @Patch('settings')
  @Roles(AdminRole.superadmin)
  updateSettings(@Body() body: Record<string, unknown>) {
    return this.admin.updateSettings(body);
  }
}
