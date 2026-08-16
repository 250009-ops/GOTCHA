import {
  Allow,
  IsBoolean,
  IsEmail,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
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
  @IsIn(['en', 'ru', 'uz', 'fr', 'es', 'ja', 'de', 'ko', 'pt'])
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
  @IsIn(['en', 'ru', 'uz', 'fr', 'es', 'ja', 'de', 'ko', 'pt'])
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
  @IsNumber()
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
  @IsNumber()
  aiDefaultUserQuota?: number;
}
