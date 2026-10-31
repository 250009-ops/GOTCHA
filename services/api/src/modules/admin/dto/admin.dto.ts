import { Type } from 'class-transformer';
import { AppLanguage } from '@prisma/client';
import {
  Allow,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdateAdminProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  displayName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}

export class CreateContentDto {
  @IsString()
  @MinLength(1)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  author?: string;

  @IsOptional()
  @IsString()
  sourceUrl?: string;

  @IsOptional()
  @IsString()
  plainText?: string;

  @IsOptional()
  @IsEnum(AppLanguage)
  language?: string;

  @IsOptional()
  @IsIn(['book', 'article', 'story', 'news', 'user_import'])
  contentType?: string;

  @IsOptional()
  @IsIn(['a1', 'a2', 'b1', 'b2', 'c1', 'c2'])
  cefrLevel?: string;

  @IsOptional()
  @IsString()
  genre?: string;

  @IsOptional()
  @IsIn(['public_domain', 'licensed', 'rss', 'user_import', 'ai_generated'])
  contentSource?: string;

  @IsOptional()
  @IsString()
  licenseId?: string;

  @IsOptional()
  @IsBoolean()
  isFree?: boolean;

  @IsOptional()
  @IsNumber()
  priceUsd?: number;

  @IsOptional()
  @IsNumber()
  priceUzs?: number;

  @IsOptional()
  @Allow()
  chapters?: Array<{ title: string; text: string }>;
}

export class UpdateContentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  author?: string;

  @IsOptional()
  @IsString()
  genre?: string;

  @IsOptional()
  @IsEnum(AppLanguage)
  language?: string;

  @IsOptional()
  @IsIn(['book', 'article', 'story', 'news', 'user_import'])
  contentType?: string;

  @IsOptional()
  @IsIn(['a1', 'a2', 'b1', 'b2', 'c1', 'c2'])
  cefrLevel?: string;

  @IsOptional()
  @IsIn(['draft', 'review', 'published', 'archived'])
  publishStatus?: string;

  @IsOptional()
  @IsBoolean()
  isFree?: boolean;

  @IsOptional()
  @IsNumber()
  priceUsd?: number;

  @IsOptional()
  @IsNumber()
  priceUzs?: number;

  @IsOptional()
  @IsIn(['public_domain', 'licensed', 'rss', 'user_import', 'ai_generated'])
  contentSource?: string;

  @IsOptional()
  @IsString()
  sourceUrl?: string;

  @IsOptional()
  @IsString()
  plainText?: string;

  @IsOptional()
  @Allow()
  chapters?: Array<{ title: string; text: string }>;

  @IsOptional()
  @IsNumber()
  salesCount?: number;
}

export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  platformName?: string;

  @IsOptional()
  @ValidateIf((_, v) => typeof v === 'string' && v.trim().length > 0)
  @IsEmail()
  supportEmail?: string;

  @IsOptional()
  @IsBoolean()
  maintenanceMode?: boolean;

  @IsOptional()
  @IsBoolean()
  allowRegistrations?: boolean;

  @IsOptional()
  @IsIn(['a1', 'a2', 'b1', 'b2', 'c1', 'c2'])
  defaultCefr?: string;

  @IsOptional()
  @IsBoolean()
  contentModerationEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  autoApproveImports?: boolean;

  @IsOptional()
  @IsBoolean()
  aiEnabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  aiDailyLimit?: number;

  @IsOptional()
  @IsString()
  aiLookupModel?: string;

  @IsOptional()
  @IsString()
  aiQuizModel?: string;

  @IsOptional()
  @IsString()
  aiImportCleanupModel?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  aiDefaultUserQuota?: number;
}

export class UpdateAiLimitsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  aiDefaultUserQuota?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  aiDailyLimit?: number;
}

/** REVIEW m10: validated refund body (full refunds only; amountUzs must equal the payment). */
export class RefundPaymentDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  amountUzs?: number;
}
