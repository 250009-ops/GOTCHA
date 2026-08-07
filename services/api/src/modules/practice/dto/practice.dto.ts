import { IsEnum, IsOptional, IsString } from 'class-validator';
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
  answers!: SubmitAnswerDto[];
}
