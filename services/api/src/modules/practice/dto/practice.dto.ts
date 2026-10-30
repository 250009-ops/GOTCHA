import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';
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
