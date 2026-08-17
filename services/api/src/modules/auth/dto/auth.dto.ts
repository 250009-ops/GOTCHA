import { IsEmail, IsEnum, IsOptional, IsString, MinLength, MaxLength, IsArray, ArrayMinSize } from 'class-validator';
import { AppLanguage } from '@prisma/client';

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
}

export class VerifyEmailDto {
  @IsString()
  @MinLength(16)
  token!: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email!: string;
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
