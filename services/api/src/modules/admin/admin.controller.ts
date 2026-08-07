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

  @Get('dashboard')
  @Roles(AdminRole.superadmin, AdminRole.analyst, AdminRole.editor)
  dashboard() {
    return this.admin.dashboard();
  }

  @Get('content')
  @Roles(AdminRole.superadmin, AdminRole.editor)
  content(@Query('status') status?: PublishStatus) {
    return this.admin.listContent(status);
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
}
