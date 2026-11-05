import { IsBoolean, IsEmail, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min, MinLength, MaxLength, IsArray, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { AppLanguage } from '@prisma/client';
import { UI_LANGUAGES } from '@gotcha/shared';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsEnum(AppLanguage)
  nativeLanguage!: AppLanguage;

  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(AppLanguage, { each: true })
  targetLanguages!: AppLanguage[];

  @IsOptional()
  @IsIn([...UI_LANGUAGES])
  uiLanguage?: (typeof UI_LANGUAGES)[number];

  /** When `android`, auth emails use `gotcha://` deep links that open the mobile app. */
  @IsOptional()
  @IsIn(['android', 'web'])
  clientPlatform?: 'android' | 'web';

  /** Terms + Privacy tick. Must be true on web. */
  @IsOptional()
  @IsBoolean()
  acceptTerms?: boolean;

  /** Separate OpenAI / AI-processing tick. Must be true on web. Stored as an audit row, not a user column. */
  @IsOptional()
  @IsBoolean()
  acceptAiConsent?: boolean;

  /** S3: the tick-box label version the client showed (PAY2-17: absent = the pre-oferta .3 client; unknown = 400). */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  consentVersion?: string;

  /** W-12: optional birth year (no minimum age). Unknown = AGE_UNKNOWN_BAND limits. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(new Date().getUTCFullYear())
  birthYear?: number;
}

export class LoginDto {
  /** Kept for existing clients. */
  @IsOptional()
  @IsEmail()
  email?: string;

  /** Email or phone. Used when `email` is omitted. */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  identifier?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @IsString()
  deviceName?: string;
}

export class RefreshDto {
  @IsString()
  @MinLength(16)
  @MaxLength(512)
  refreshToken!: string;
}

export class ResendEmailVerificationDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsIn(['android', 'web'])
  clientPlatform?: 'android' | 'web';
}

export class VerifyEmailDto {
  @IsString()
  @MinLength(16)
  token!: string;
}

export class ForgotPasswordDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  /** Email or phone. Phone accounts receive the reset code in Telegram. */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  identifier?: string;

  @IsOptional()
  @IsIn(['android', 'web'])
  clientPlatform?: 'android' | 'web';
}

export class TelegramInitDto {
  @IsString()
  @MinLength(8)
  @MaxLength(8192)
  initData!: string;
}

export class TelegramRegisterDto extends TelegramInitDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  fullName!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsEnum(AppLanguage)
  nativeLanguage!: AppLanguage;

  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(AppLanguage, { each: true })
  targetLanguages!: AppLanguage[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(new Date().getUTCFullYear())
  birthYear?: number;

  @IsBoolean()
  acceptTerms!: boolean;

  @IsOptional()
  @IsBoolean()
  acceptAi?: boolean;

  @IsOptional()
  @IsBoolean()
  acceptAiConsent?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  consentVersion?: string;
}

export class TelegramLinkDto extends TelegramInitDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  identifier!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}

export class TelegramCodeDto {
  @IsString()
  @MinLength(16)
  @MaxLength(64)
  challengeId!: string;

  @IsString()
  @MinLength(4)
  @MaxLength(16)
  code!: string;
}

export class TelegramResendDto {
  @IsString()
  @MinLength(16)
  @MaxLength(64)
  challengeId!: string;
}

export class TelegramResetDto extends TelegramCodeDto {
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(16)
  token!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
