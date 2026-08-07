import { IsEnum, IsOptional, IsString, IsUrl, MinLength } from 'class-validator';
import { AppLanguage } from '@prisma/client';

export class ImportPasteDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @MinLength(1)
  text!: string;

  @IsOptional()
  @IsEnum(AppLanguage)
  language?: AppLanguage;
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
}

export class ImportFileDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsEnum(AppLanguage)
  language?: AppLanguage;
}
