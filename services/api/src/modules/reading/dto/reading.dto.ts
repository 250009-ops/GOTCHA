import { IsEnum, IsInt, IsOptional, IsString, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { WordStatus } from '@prisma/client';

export class StartSessionDto {
  @IsUUID()
  contentId!: string;

  @IsOptional()
  @IsUUID()
  segmentId?: string;
}

export class MarkLemmaDto {
  @IsString()
  lemma!: string;

  @IsString()
  sourceLang!: string;

  @IsEnum(WordStatus)
  status!: WordStatus;
}

export class EndSessionDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  durationSeconds?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  wordsTapped?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  wordsSaved?: number;
}

export class UpdateProgressDto {
  @IsOptional()
  @IsUUID()
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
