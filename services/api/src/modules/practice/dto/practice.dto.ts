import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min, ValidateNested } from 'class-validator';
import { PracticeType } from '@prisma/client';

export class StartPracticeDto {
  @IsOptional()
  @IsString()
  contentId?: string;

  @IsOptional()
  @IsString()
  segmentId?: string;

  @IsEnum(PracticeType)
  practiceType!: PracticeType;

  /** page_bank serves stored Mashq questions for this page and does not use the chapter-quiz cap. */
  @IsOptional()
  @IsIn(['page_bank'])
  source?: 'page_bank';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(3)
  @Max(20)
  count?: number;

  @IsOptional()
  @IsUUID()
  idempotencyKey?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  repeatMissed?: boolean;
}

export class SubmitAnswerDto {
  @IsString()
  questionId!: string;

  @IsString()
  userAnswer!: string;
}

export class SubmitPracticeDto {
  // Without these decorators class-validator's global whitelist strips `answers` entirely
  // (property has no validation metadata), so POST /practice/sessions/:id/answers always
  // received an empty payload — see docs/E2E_AUDIT_REPORT.md's practice-page remediation.
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SubmitAnswerDto)
  answers!: SubmitAnswerDto[];
}
