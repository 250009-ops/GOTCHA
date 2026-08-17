import { IsEnum, IsOptional, IsString, IsUrl, IsUUID, MaxLength, MinLength } from 'class-validator';
import { AppLanguage } from '@prisma/client';

export class ImportPasteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20_000_000)
  text!: string;

  @IsOptional()
  @IsEnum(AppLanguage)
  language?: AppLanguage;

  /** Paid/free ImportPayment id from /billing/imports/checkout */
  @IsOptional()
  @IsUUID()
  paymentId?: string;
}

export class ImportUrlDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsString()
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  url!: string;

  @IsOptional()
  @IsEnum(AppLanguage)
  language?: AppLanguage;

  @IsOptional()
  @IsUUID()
  paymentId?: string;
}

export class ImportFileDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsEnum(AppLanguage)
  language?: AppLanguage;

  @IsOptional()
  @IsUUID()
  paymentId?: string;
}
