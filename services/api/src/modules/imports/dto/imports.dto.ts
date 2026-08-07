import { IsEnum, IsOptional, IsString } from 'class-validator';
import { AppLanguage } from '@prisma/client';

export class ImportPasteDto {
  @IsString()
  title!: string;

  @IsString()
  text!: string;

  @IsOptional()
  @IsEnum(AppLanguage)
  language?: AppLanguage;
}

export class ImportUrlDto {
  @IsString()
  title!: string;

  @IsString()
  url!: string;

  @IsOptional()
  @IsEnum(AppLanguage)
  language?: AppLanguage;
}
