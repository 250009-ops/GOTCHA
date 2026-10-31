import { jobHealth } from '../../common/jobs/job-health';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { AdminRole, LicenseStatus, ModerationStatus, PublishStatus } from '@prisma/client';
import { CurrentUser, AuthUserPayload, Roles } from '../../common/decorators';
import { RolesGuard } from '../../common/guards';
import { AdminService } from './admin.service';
import { CreateContentDto, UpdateAdminProfileDto, UpdateAiLimitsDto, UpdateContentDto, UpdateSettingsDto } from './dto/admin.dto';
import { MAX_FILE_BYTES } from '../imports/extract-text';

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

  /** Admin self-service profile update (own display name / email). See users.controller.ts's PATCH /users/me for the learner equivalent. */
  @Patch('me')
  @Roles(AdminRole.superadmin, AdminRole.analyst, AdminRole.editor, AdminRole.moderator)
  updateMe(@CurrentUser() user: AuthUserPayload, @Body() dto: UpdateAdminProfileDto) {
    return this.admin.updateMe(user.sub, dto);
  }

  /** Send a password-reset email to the signed-in admin (links back to admin console after reset). */
  @Post('me/request-password-reset')
  @Roles(AdminRole.superadmin, AdminRole.analyst, AdminRole.editor, AdminRole.moderator)
  requestPasswordReset(@CurrentUser() user: AuthUserPayload) {
    return this.admin.requestPasswordReset(user.sub);
  }

  /** LG4-09: retention/deletion job health (false = a job failed; see lastError). */
  @Get('health/jobs')
  @Roles(AdminRole.superadmin, AdminRole.moderator)
  jobsHealth() {
    return jobHealth();
  }

  @Get('dashboard')
  @Roles(AdminRole.superadmin, AdminRole.analyst, AdminRole.editor)
  dashboard() {
    return this.admin.dashboard();
  }

  @Get('users')
  @Roles(AdminRole.superadmin, AdminRole.analyst, AdminRole.moderator)
  users(
    @Query('q') q?: string,
    @Query('tier') tier?: string,
    @Query('status') status?: string,
  ) {
    return this.admin.listUsers(q, tier, status);
  }

  @Get('users/:id')
  @Roles(AdminRole.superadmin, AdminRole.analyst, AdminRole.moderator)
  getUser(@Param('id') id: string) {
    return this.admin.getUser(id);
  }

  @Patch('users/:id')
  @Roles(AdminRole.superadmin)
  updateUser(
    @Param('id') id: string,
    @Body() body: { displayName?: string; deleted?: boolean; tier?: string },
  ) {
    return this.admin.updateUser(id, body);
  }

  @Post('users/:id/reset-password')
  @Roles(AdminRole.superadmin)
  resetUserPassword(@Param('id') id: string) {
    return this.admin.resetUserPassword(id);
  }

  @Post('users/:id/adjust-tier')
  @Roles(AdminRole.superadmin)
  adjustUserTier(@Param('id') id: string, @Body() body: { tier?: string }) {
    return this.admin.adjustUserTier(id, String(body.tier ?? ''));
  }

  @Delete('users/:id')
  @Roles(AdminRole.superadmin)
  hardDeleteUser(@Param('id') id: string) {
    return this.admin.hardDeleteUser(id);
  }

  @Get('content')
  @Roles(AdminRole.superadmin, AdminRole.editor)
  content(@Query('status') status?: PublishStatus) {
    return this.admin.listContent(status);
  }

  @Get('content/curriculum')
  @Roles(AdminRole.superadmin, AdminRole.editor, AdminRole.analyst)
  curriculum(
    @Query('type') type?: string,
    @Query('language') language?: string,
    @Query('level') level?: string,
    @Query('q') q?: string,
  ) {
    return this.admin.listCurriculum(type, language, level, q);
  }

  @Get('content/stats')
  @Roles(AdminRole.superadmin, AdminRole.editor, AdminRole.analyst)
  contentStats(@Query('language') language?: string, @Query('level') level?: string) {
    return this.admin.contentStats(language, level);
  }

  @Get('content/pricing-rules')
  @Roles(AdminRole.superadmin, AdminRole.editor, AdminRole.analyst)
  catalogPricingRules() {
    return this.admin.getCatalogPricingRules();
  }

  @Patch('content/pricing-rules')
  @Roles(AdminRole.superadmin, AdminRole.editor)
  updateCatalogPricingRules(@Body() body: Record<string, unknown>) {
    return this.admin.updateCatalogPricingRules(body);
  }

  @Post('content/ingest-preview')
  @Roles(AdminRole.superadmin, AdminRole.editor)
  ingestPreview(@Body() body: Record<string, unknown>) {
    return this.admin.previewContentIngest(body);
  }

  @Post('content/ingest-preview-file')
  @Roles(AdminRole.superadmin, AdminRole.editor)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        title: { type: 'string' },
        contentType: { type: 'string' },
        language: { type: 'string' },
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
  ingestPreviewFile(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: Record<string, string>,
  ) {
    if (!file?.buffer?.length) throw new BadRequestException('PDF file is required');
    const name = (file.originalname || '').toLowerCase();
    const mime = (file.mimetype || '').toLowerCase();
    if (!name.endsWith('.pdf') && mime !== 'application/pdf') {
      throw new BadRequestException('Only PDF files are supported');
    }
    return this.admin.previewContentIngest({
      title: body.title,
      contentType: body.contentType,
      language: body.language,
      pdfBuffer: file.buffer,
    });
  }

  @Post('content')
  @Roles(AdminRole.superadmin, AdminRole.editor)
  createContent(@CurrentUser() user: AuthUserPayload, @Body() body: CreateContentDto) {
    return this.admin.createContent(user.sub, body as unknown as Record<string, unknown>);
  }

  @Get('content/:id/reader')
  @Roles(AdminRole.superadmin, AdminRole.editor, AdminRole.analyst)
  getContentReader(@Param('id') id: string) {
    return this.admin.getContentReader(id);
  }

  @Get('content/:id/reader/page')
  @Roles(AdminRole.superadmin, AdminRole.editor, AdminRole.analyst)
  getContentReaderPage(@Param('id') id: string, @Query('from') from?: string) {
    return this.admin.getContentReaderPage(id, Number(from ?? 0));
  }

  @Get('content/:id')
  @Roles(AdminRole.superadmin, AdminRole.editor, AdminRole.analyst)
  getContent(@Param('id') id: string) {
    return this.admin.getContent(id);
  }

  @Post('content/:id/cover')
  @Roles(AdminRole.superadmin, AdminRole.editor)
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
      limits: { fileSize: 4 * 1024 * 1024 },
    }),
  )
  uploadCover(@Param('id') id: string, @UploadedFile() file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException('File is required');
    return this.admin.uploadContentCover(id, file);
  }

  @Patch('content/:id/reingest')
  @Roles(AdminRole.superadmin, AdminRole.editor)
  reingestContent(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.admin.reingestContentText(id, body);
  }

  @Patch('content/:id')
  @Roles(AdminRole.superadmin, AdminRole.editor)
  updateContent(@Param('id') id: string, @Body() body: UpdateContentDto) {
    return this.admin.updateContent(id, body as unknown as Record<string, unknown>);
  }

  @Patch('content/:id/publish')
  @Roles(AdminRole.superadmin, AdminRole.editor)
  publish(@Param('id') id: string) {
    return this.admin.publishContent(id);
  }

  @Patch('content/:id/archive')
  @Roles(AdminRole.superadmin, AdminRole.editor)
  archive(@Param('id') id: string) {
    return this.admin.deleteContent(id);
  }

  @Delete('content/:id')
  @Roles(AdminRole.superadmin, AdminRole.editor)
  deleteContent(@Param('id') id: string) {
    return this.admin.deleteContent(id);
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

  @Get('import-pricing')
  @Roles(AdminRole.superadmin, AdminRole.analyst, AdminRole.editor)
  importPricing(@Query('range') range?: string) {
    return this.admin.importPricing(range);
  }

  @Patch('import-pricing/rules')
  @Roles(AdminRole.superadmin, AdminRole.editor)
  updateImportPricingRules(@Body() body: { rules?: Array<Record<string, unknown>> }) {
    return this.admin.updateImportPricingRules(body);
  }

  @Post('import-pricing/tiers')
  @Roles(AdminRole.superadmin, AdminRole.editor)
  createImportPageTier(@Body() body: Record<string, unknown>) {
    return this.admin.createImportPageTier(body);
  }

  @Patch('import-pricing/tiers/:id')
  @Roles(AdminRole.superadmin, AdminRole.editor)
  updateImportPageTier(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.admin.updateImportPageTier(id, body);
  }

  @Delete('import-pricing/tiers/:id')
  @Roles(AdminRole.superadmin, AdminRole.editor)
  deleteImportPageTier(@Param('id') id: string) {
    return this.admin.deleteImportPageTier(id);
  }

  @Get('import-pricing/limits')
  @Roles(AdminRole.superadmin, AdminRole.analyst, AdminRole.editor)
  importFreeLimits() {
    return this.admin.getImportFreeLimits();
  }

  @Patch('import-pricing/limits')
  @Roles(AdminRole.superadmin, AdminRole.editor)
  updateImportFreeLimits(@Body() body: Record<string, unknown>) {
    return this.admin.updateImportFreeLimits(body);
  }

  @Get('ai-usage')
  @Roles(AdminRole.superadmin, AdminRole.analyst, AdminRole.editor)
  aiUsage(@Query('range') range?: string) {
    return this.admin.aiUsage(range);
  }

  @Patch('ai-usage/limits')
  @Roles(AdminRole.superadmin, AdminRole.editor, AdminRole.analyst)
  updateAiUsageLimits(@Body() body: UpdateAiLimitsDto) {
    return this.admin.updateSettings({
      aiDefaultUserQuota: body.aiDefaultUserQuota,
      aiDailyLimit: body.aiDailyLimit,
    });
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

  @Post('languages')
  @Roles(AdminRole.superadmin, AdminRole.editor)
  addLanguage(@Body() body: { code?: string }) {
    return this.admin.addLanguage(String(body.code ?? ''));
  }

  @Patch('languages/:code')
  @Roles(AdminRole.superadmin, AdminRole.editor)
  updateLanguage(@Param('code') code: string, @Body() body: { isEnabled?: boolean; status?: string }) {
    return this.admin.updateLanguage(code, body);
  }

  @Delete('languages/:code')
  @Roles(AdminRole.superadmin, AdminRole.editor)
  removeLanguage(@Param('code') code: string) {
    return this.admin.removeLanguage(code);
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
  updateSettings(@Body() body: UpdateSettingsDto) {
    return this.admin.updateSettings(body as unknown as Record<string, unknown>);
  }
}
