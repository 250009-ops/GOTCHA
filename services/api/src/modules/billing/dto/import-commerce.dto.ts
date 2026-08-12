import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ImportType } from '@prisma/client';

export class ImportQuoteDto {
  @IsEnum(ImportType)
  importType!: ImportType;

  @IsOptional()
  @IsString()
  contentFormat?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5_000_000)
  textLength?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2_000_000)
  wordCount?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  pageCount?: number;
}

export class ImportCheckoutDto extends ImportQuoteDto {
  @IsOptional()
  @IsIn(['web', 'android'])
  platform?: 'web' | 'android';
}
