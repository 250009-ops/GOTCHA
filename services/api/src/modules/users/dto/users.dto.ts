import { IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, IsBoolean, Min, Max, MinLength, MaxLength, Matches } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { AppLanguage, CefrLevel } from '@prisma/client';

/** No control characters and no links. Empty (after trim) clears the name. */
const DISPLAY_NAME = /^(?!.*(?:https?:\/\/|www\.))[^\u0000-\u001F\u007F\u2028\u2029]*$/u;

export class UpdateProfileDto {
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  })
  @IsString()
  @MaxLength(50)
  @Matches(DISPLAY_NAME, { message: 'Display name cannot contain links or control characters.' })
  displayName?: string | null;

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
  @IsIn(['light', 'sepia', 'dark'])
  readerTheme?: 'light' | 'sepia' | 'dark';

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

  /** Practice hub options are 30 / 60 / 120 / 200. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(500)
  dailyGoalXp?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(50)
  dailyNewWords?: number;

  @IsOptional()
  @IsBoolean()
  notificationsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  onboardingDone?: boolean;

  /** When false (the default, and the default for minors), peers do not see online status or last seen. */
  @IsOptional()
  @IsBoolean()
  showOnlineStatus?: boolean;

  /** `dark` is still accepted so older clients don't get a 400. The service stores it as `system`. */
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
