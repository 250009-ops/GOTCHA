import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AppLanguage } from '@prisma/client';

export class LookupDto {
  @IsString()
  @MaxLength(80)
  token!: string;

  /** Narrow context only (sentence / short window) — never a full chapter. */
  @IsString()
  @MaxLength(500)
  sentence!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  lemma?: string;

  @IsEnum(AppLanguage)
  sourceLang!: AppLanguage;

  @IsEnum(AppLanguage)
  targetLang!: AppLanguage;
}

export class TranslateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  text!: string;

  @IsEnum(AppLanguage)
  sourceLang!: AppLanguage;

  @IsEnum(AppLanguage)
  targetLang!: AppLanguage;
}
