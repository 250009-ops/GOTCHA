import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AppLanguage } from '@prisma/client';

export class LookupDto {
  @IsString()
  @MaxLength(4000)
  token!: string;

  /** Sentence, or the selected span when the learner highlights a long passage. */
  @IsString()
  @MaxLength(4000)
  sentence!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
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

export class SpeechDto {
  @IsString()
  @MinLength(1)
  @MaxLength(400)
  text!: string;

  @Transform(({ value }) => String(value ?? 'en').trim().toLowerCase().replace(/_/g, '-').slice(0, 2))
  @IsEnum(AppLanguage)
  lang!: AppLanguage;
}
