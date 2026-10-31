import { IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, IsBoolean, Min, Max, MinLength, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { AppLanguage, CefrLevel } from '@prisma/client';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsEnum(AppLanguage)
  uiLanguage?: AppLanguage;

  @IsOptional()
  @IsEnum(AppLanguage)
  nativeLanguage?: AppLanguage;
}

export class UpdatePreferencesDto {
  @IsOptional()
  @IsNumber()
  @Min(0.8)
  @Max(1.6)
  readerFontScale?: number;

  @IsOptional()
  @IsString()
  readerTheme?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(2.5)
  readerLineSpacing?: number;

  @IsOptional()
  @IsBoolean()
  showKnownWords?: boolean;

  @IsOptional()
  @IsBoolean()
  ttsEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(120)
  dailyGoalMinutes?: number;

  @IsOptional()
  @IsBoolean()
  notificationsEnabled?: boolean;

  @IsOptional()
  @IsIn(['system', 'light', 'dark'])
  appTheme?: 'system' | 'light' | 'dark';
}

export class ChangePasswordDto {
  @IsString()
  @MaxLength(128)
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}

export class AddTargetLanguageDto {
  @IsEnum(AppLanguage)
  targetLanguage!: AppLanguage;

  @IsOptional()
  @IsEnum(CefrLevel)
  cefrLevel?: CefrLevel;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class UpdateTargetLanguageDto {
  @IsOptional()
  @IsEnum(CefrLevel)
  cefrLevel?: CefrLevel;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class SetAgeDto {
  /** Omit/null = "prefer not to say" (unknown-age limits apply). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(new Date().getUTCFullYear())
  birthYear?: number | null;
}

export class DeleteAccountDto {
  @IsString()
  @MaxLength(128)
  currentPassword!: string;
}

export class SetAiPreferenceDto {
  @IsBoolean()
  aiDisabled!: boolean;
}
