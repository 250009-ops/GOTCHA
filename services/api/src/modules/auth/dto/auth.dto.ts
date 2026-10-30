import { IsEmail, IsEnum, IsIn, IsOptional, IsString, MinLength, MaxLength, IsArray, ArrayMinSize } from 'class-validator';
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
