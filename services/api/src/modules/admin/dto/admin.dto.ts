import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
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
  @IsString()
  licenseId?: string;

  @IsOptional()
  @IsBoolean()
  isFree?: boolean;

  @IsOptional()
  @IsNumber()
  priceUsd?: number;
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
  @IsNumber()
  aiDefaultUserQuota?: number;
}
