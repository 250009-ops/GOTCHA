import { IsEnum, IsNumber, IsOptional, IsString, IsBoolean, Min, Max, MinLength } from 'class-validator';
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
  dailyGoalMinutes?: number;

  @IsOptional()
  @IsBoolean()
  notificationsEnabled?: boolean;
}

export class ChangePasswordDto {
  @IsString()
  currentPassword!: string;

  @IsString()
  @MinLength(8)
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

export class DeleteAccountDto {
  @IsString()
  currentPassword!: string;
}
