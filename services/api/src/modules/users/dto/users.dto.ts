import { IsEnum, IsNumber, IsOptional, IsString, IsBoolean, Min, Max } from 'class-validator';
import { AppLanguage } from '@prisma/client';

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
