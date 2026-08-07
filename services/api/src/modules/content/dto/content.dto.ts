import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { AppLanguage, CefrLevel, ContentSource, ContentType } from '@prisma/client';

export class ContentQueryDto {
  @IsOptional()
  @IsEnum(AppLanguage)
  lang?: AppLanguage;

  @IsOptional()
  @IsEnum(CefrLevel)
  level?: CefrLevel;

  @IsOptional()
  @IsString()
  genre?: string;

  @IsOptional()
  @IsEnum(ContentType)
  type?: ContentType;

  @IsOptional()
  @IsEnum(ContentSource)
  source?: ContentSource;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = 20;
}

export class UpdateProgressDto {
  @IsOptional()
  @IsString()
  segmentId?: string;

  @IsOptional()
  @Type(() => Number)
  charOffset?: number;

  @IsOptional()
  @Type(() => Number)
  progressPct?: number;

  @IsOptional()
  @Type(() => Number)
  readSeconds?: number;

  @IsOptional()
  completed?: boolean;
}
