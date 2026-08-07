import { IsEnum, IsOptional, IsString } from 'class-validator';
import { AppLanguage } from '@prisma/client';

export class LookupDto {
  @IsString()
  token!: string;

  @IsString()
  sentence!: string;

  @IsEnum(AppLanguage)
  sourceLang!: AppLanguage;

  @IsEnum(AppLanguage)
  targetLang!: AppLanguage;
}
