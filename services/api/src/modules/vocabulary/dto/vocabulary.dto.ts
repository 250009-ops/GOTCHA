import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { AppLanguage, SrsRating } from '@prisma/client';

export class SaveVocabularyDto {
  @IsString()
  lemma!: string;

  @IsEnum(AppLanguage)
  sourceLang!: AppLanguage;

  @IsEnum(AppLanguage)
  targetLang!: AppLanguage;

  @IsString()
  translation!: string;

  @IsOptional()
  @IsString()
  contextSentence?: string;

  @IsOptional()
  @IsString()
  contextSegmentId?: string;

  @IsOptional()
  @IsString()
  contentId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ReviewVocabularyDto {
  @IsEnum(SrsRating)
  rating!: SrsRating;
}

export class UpdateVocabularyDto {
  @IsOptional()
  @IsBoolean()
  mastered?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}
