import { jobHealth } from '../../common/jobs/job-health';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
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
import { AdminOpsService } from './admin-ops.service';
import { PricingService } from '../billing/pricing.service';
import { PlanUpdateDto, PromoDto, StoreProductDto } from './dto/pricing.dto';

const jsonSafe = (v: unknown) => JSON.parse(JSON.stringify(v));
import { CreateContentDto, UpdateAchievementDto, UpdateAdminProfileDto, UpdateAiLimitsDto, UpdateContentDto, UpdateSettingsDto, RefundPaymentDto } from './dto/admin.dto';
import { MAX_FILE_BYTES } from '../imports/extract-text';

const actorIdOf = (u?: AuthUserPayload): string | null => ((u as { sub?: string; id?: string } | undefined)?.sub ?? (u as { id?: string } | undefined)?.id ?? null);

@ApiTags('admin')
@Controller('admin')
@UseGuards(RolesGuard)
export class AdminController {
  constructor(
    private admin: AdminService,
    private ops: AdminOpsService,
    private pricing: PricingService,
  ) {}

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
  async updateUser(
    @CurrentUser() actor: AuthUserPayload,
    @Param('id') id: string,
    @Body() body: { displayName?: string; deleted?: boolean; tier?: string },
  ) {
    const res = await this.admin.updateUser(id, body);
    if (body.deleted !== undefined) await this.ops.audit(actor.sub, body.deleted ? 'user.block' : 'user.unblock', 'user', id);
    return res;
  }

  @Post('users/:id/reset-password')
  @Roles(AdminRole.superadmin)
  async resetUserPassword(@CurrentUser() actor: AuthUserPayload, @Param('id') id: string) {
    const res = await this.admin.resetUserPassword(id);
    await this.ops.audit(actor.sub, 'user.reset_password', 'user', id);
    return res;
  }

  @Post('users/:id/adjust-tier')
  @Roles(AdminRole.superadmin)
  async adjustUserTier(@CurrentUser() actor: AuthUserPayload, @Param('id') id: string, @Body() body: { tier?: string; days?: number; until?: string }) {
    const res = await this.admin.adjustUserTier(id, String(body.tier ?? ''), { days: body.days, until: body.until });
    await this.ops.audit(actor.sub, 'user.adjust_tier', 'user', id, { tier: String(body.tier ?? ''), days: body.days ?? null, until: body.until ?? null });
    return res;
  }

  @Get('users/:id/export')
  @Roles(AdminRole.superadmin)
  exportUser(@CurrentUser() actor: AuthUserPayload, @Param('id') id: string) {
    return this.ops.exportUser(actor.sub, id);
  }

  @Get('payments')
  @Roles(AdminRole.superadmin, AdminRole.analyst)
  payments(
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.ops.listPayments({ status, q, page: Number(page), pageSize: Number(pageSize) });
  }

  /**
   * Full refund: claim → Atmos reverse (idempotency key) → finalize + audit. Local-only (no money moved) only when
   * ATMOS_SANDBOX is explicitly true. Repeating the call for a refunded payment returns the existing result.
   */
  @Post('payments/:id/refund')
  @Roles(AdminRole.superadmin)
  refundPayment(
    @CurrentUser() actor: AuthUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RefundPaymentDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.ops.refundPayment(actor.sub, id, body, idempotencyKey?.slice(0, 100));
  }

  /** Close a refunding row after Atmos confirms, or when an admin records why it is complete. */
  @Post('payments/:id/refund/finalize')
  @Roles(AdminRole.superadmin)
  finalizeRefund(
    @CurrentUser() actor: AuthUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RefundPaymentDto,
  ) {
    return this.ops.finalizeRefund(actor.sub, id, body);
  }

  /** Atmos said the charge was not reversed. This is the only path that moves refunding back to paid. */
  @Post('payments/:id/refund/not-reversed')
  @Roles(AdminRole.superadmin)
  markRefundNotReversed(
    @CurrentUser() actor: AuthUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RefundPaymentDto,
  ) {
    return this.ops.markRefundNotReversed(actor.sub, id, body);
  }

  /** Resolve refunds stuck in `refunding` (also runs every 10 minutes). */
  @Post('payments/reconcile')
  @Roles(AdminRole.superadmin)
  reconcilePayments() {
    return this.ops.reconcileRefunds();
  }

  @Delete('users/:id')
  @Roles(AdminRole.superadmin)
  hardDeleteUser(@Param('id') id: string, @Query('confirm') confirm?: string, @CurrentUser() user?: AuthUserPayload) {
    return this.admin.hardDeleteUser(id, { confirm, actorId: actorIdOf(user) });
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

  /** covers-01: 'Use template' / 'Use upload' / 'Revert to original' per book. */
  @Patch('content/:id/cover-mode')
  @Roles(AdminRole.superadmin, AdminRole.editor)
  setCoverMode(@Param('id') id: string, @Body() body: { coverMode?: unknown }, @CurrentUser() user?: AuthUserPayload) {
    return this.admin.setContentCoverMode(id, body?.coverMode, actorIdOf(user));
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

  @Get('import-pricing')
  @Roles(AdminRole.superadmin, AdminRole.analyst, AdminRole.editor)
  importPricing(@Query('range') range?: string) {
    return this.admin.importPricing(range);
  }

  @Patch('import-pricing/rules')
  @Roles(AdminRole.superadmin, AdminRole.editor)
  async updateImportPricingRules(@CurrentUser() actor: AuthUserPayload, @Body() body: { rules?: Array<Record<string, unknown>> }) {
    const res = await this.admin.updateImportPricingRules(body);
    await this.ops.audit(actor.sub, 'pricing.rules.update', 'platform_setting', null, { rules: (body.rules ?? []) as never });
    return res;
  }

  @Post('import-pricing/tiers')
  @Roles(AdminRole.superadmin, AdminRole.editor)
  async createImportPageTier(@CurrentUser() actor: AuthUserPayload, @Body() body: Record<string, unknown>) {
    const res = await this.admin.createImportPageTier(body);
    await this.ops.audit(actor.sub, 'pricing.tier.create', 'import_page_tier', null, { after: body as never });
    return res;
  }

  @Patch('import-pricing/tiers/:id')
  @Roles(AdminRole.superadmin, AdminRole.editor)
  async updateImportPageTier(@CurrentUser() actor: AuthUserPayload, @Param('id', ParseUUIDPipe) id: string, @Body() body: Record<string, unknown>) {
    const res = await this.admin.updateImportPageTier(id, body);
    await this.ops.audit(actor.sub, 'pricing.tier.update', 'import_page_tier', id, { changes: body as never });
    return res;
  }

  @Delete('import-pricing/tiers/:id')
  @Roles(AdminRole.superadmin, AdminRole.editor)
  async deleteImportPageTier(@CurrentUser() actor: AuthUserPayload, @Param('id', ParseUUIDPipe) id: string) {
    const res = await this.admin.deleteImportPageTier(id);
    await this.ops.audit(actor.sub, 'pricing.tier.delete', 'import_page_tier', id);
    return res;
  }

  // ---------------------------------------------------------------- pricing (plans, tiers, promo codes)

  /** Plans, page tiers and promo codes in one payload (Payments → Pricing). */
  @Get('pricing')
  @Roles(AdminRole.superadmin, AdminRole.analyst, AdminRole.editor)
  pricingOverview() {
    return this.pricing.adminOverview();
  }

  @Patch('pricing/plans/:tier')
  @Roles(AdminRole.superadmin)
  async updatePlan(@CurrentUser() actor: AuthUserPayload, @Param('tier') tier: string, @Body() body: PlanUpdateDto) {
    const { before, after } = await this.pricing.updatePlan(tier, body);
    await this.ops.auditStrict(actor.sub, 'pricing.plan.update', 'subscription_plan', after.id, { before: jsonSafe(before), after: jsonSafe(after) });
    return after;
  }

  @Patch('pricing/tiers/:id/active')
  @Roles(AdminRole.superadmin)
  async setTierActive(@CurrentUser() actor: AuthUserPayload, @Param('id', ParseUUIDPipe) id: string, @Body() body: { active?: boolean }) {
    const { after } = await this.pricing.setTierActive(id, !!body.active);
    await this.ops.auditStrict(actor.sub, body.active ? 'pricing.tier.activate' : 'pricing.tier.deactivate', 'import_page_tier', id);
    return after;
  }

  @Post('pricing/promos')
  @Roles(AdminRole.superadmin)
  async createPromo(@CurrentUser() actor: AuthUserPayload, @Body() body: PromoDto) {
    const promo = await this.pricing.createPromo(body);
    await this.ops.auditStrict(actor.sub, 'pricing.promo.create', 'promo_code', promo.id, { after: jsonSafe(promo) });
    return promo;
  }

  @Patch('pricing/promos/:id')
  @Roles(AdminRole.superadmin)
  async updatePromo(@CurrentUser() actor: AuthUserPayload, @Param('id', ParseUUIDPipe) id: string, @Body() body: PromoDto) {
    const { before, after } = await this.pricing.updatePromo(id, body);
    await this.ops.auditStrict(actor.sub, 'pricing.promo.update', 'promo_code', id, { before: jsonSafe(before), after: jsonSafe(after) });
    return after;
  }

  @Post('pricing/store-products')
  @Roles(AdminRole.superadmin)
  async createStoreProduct(@CurrentUser() actor: AuthUserPayload, @Body() body: StoreProductDto) {
    const { after } = await this.pricing.upsertStoreProduct(body);
    await this.ops.auditStrict(actor.sub, 'pricing.store_product.create', 'store_product', after.id, { after: jsonSafe(after) });
    return after;
  }

  @Patch('pricing/store-products/:id')
  @Roles(AdminRole.superadmin)
  async updateStoreProduct(@CurrentUser() actor: AuthUserPayload, @Param('id', ParseUUIDPipe) id: string, @Body() body: StoreProductDto) {
    const { before, after } = await this.pricing.upsertStoreProduct(body, id);
    await this.ops.auditStrict(actor.sub, 'pricing.store_product.update', 'store_product', id, { before: jsonSafe(before), after: jsonSafe(after) });
    return after;
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

  /** final-5 A4/A5: Free 20 lookups / 10 quizzes, Plus 200 quizzes, Free imports 3/day + 50 pages/month (platform_settings). */
  @Get('plan-limits')
  @Roles(AdminRole.superadmin, AdminRole.analyst, AdminRole.editor)
  planLimits() {
    return this.admin.getPlanLimitsConfig();
  }

  @Patch('plan-limits')
  @Roles(AdminRole.superadmin, AdminRole.editor)
  updatePlanLimits(@Body() body: Record<string, unknown>, @CurrentUser() user?: AuthUserPayload) {
    return this.admin.updatePlanLimitsConfig(body, actorIdOf(user));
  }

  /** final-5 A10: self-service deletion requests (anonymised, data purged) and their 1-year hard-purge date. */
  @Get('users-deletion-requests')
  @Roles(AdminRole.superadmin, AdminRole.moderator)
  async deletionRequests(@CurrentUser() user?: AuthUserPayload) {
    await this.ops.audit(actorIdOf(user), 'user.deletion_requests.view', 'user', null);
    return this.admin.listDeletionRequests();
  }

  @Patch('ai-usage/limits')
  @Roles(AdminRole.superadmin, AdminRole.editor)
  async updateAiUsageLimits(@Body() body: UpdateAiLimitsDto, @CurrentUser() user?: AuthUserPayload) {
    const res = await this.admin.updateSettings({
      aiDefaultUserQuota: body.aiDefaultUserQuota,
      aiDailyLimit: body.aiDailyLimit,
    });
    await this.ops.auditStrict(actorIdOf(user), 'ai.limits.update', 'platform_setting', null, { scope: 'ai', ...(body as object) } as never);
    return res;
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

  @Patch('gamification/achievements/:id')
  @Roles(AdminRole.superadmin, AdminRole.editor)
  updateAchievement(@Param('id') id: string, @Body() body: UpdateAchievementDto, @CurrentUser() user?: AuthUserPayload) {
    return this.admin.updateAchievement(id, body, actorIdOf(user));
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

  @Get('plus-settings')
  @Roles(AdminRole.superadmin)
  plusSettings() {
    return this.admin.plusSettings();
  }

  @Get('ai/lookup-costs')
  @Roles(AdminRole.superadmin)
  lookupCosts(@Query('days') days?: string) {
    return this.admin.lookupCostSummary(days);
  }

  @Patch('plus-settings')
  @Roles(AdminRole.superadmin)
  async updatePlusSettings(@CurrentUser() actor: AuthUserPayload, @Body() body: Record<string, unknown>) {
    const res = await this.admin.updatePlusSettings(body);
    await this.ops.audit(actor.sub, 'billing.plus_settings', 'platform_setting', 'plus', body as never);
    return res;
  }

  @Get('settings')
  @Roles(AdminRole.superadmin)
  settings() {
    return this.admin.settings();
  }

  @Patch('settings')
  @Roles(AdminRole.superadmin)
  async updateSettings(@Body() body: UpdateSettingsDto, @CurrentUser() user?: AuthUserPayload) {
    const res = await this.admin.updateSettings(body as unknown as Record<string, unknown>);
    await this.ops.auditStrict(actorIdOf(user), 'settings.update', 'platform_setting', null, body as never);
    return res;
  }
}
