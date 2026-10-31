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

  /** S3: the single sign-up tick-box (Terms + Privacy + OpenAI transfer). Must be true on web. */
  @IsOptional()
  @IsBoolean()
  acceptTerms?: boolean;

  /** S3: the tick-box label version the client showed (server stores its own CONSENT_VERSION if absent). */
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
  @IsEmail()
  email!: string;

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
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsIn(['android', 'web'])
  clientPlatform?: 'android' | 'web';
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
