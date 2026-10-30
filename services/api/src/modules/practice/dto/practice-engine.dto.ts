import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID,
  Matches, Max, MaxLength, Min } from 'class-validator';
import { EXERCISE_TYPES, type ExerciseType, type SrsRatingValue } from '@gotcha/shared';

export class DailySessionQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(30)
  size?: number;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  lang?: string;

  /** Comma list of client capabilities, e.g. "listening". */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  caps?: string;

  /** Comma list of vocab ids to drill again (e.g. the summary's "practice mistakes"). */
  @IsOptional()
  @IsString()
  @MaxLength(1200)
  focus?: string;

  /** "1" = practice extra when nothing is due (half XP, schedule unchanged on success). */
  @IsOptional()
  @IsIn(['0', '1', 'true', 'false'])
  extra?: string;
}

export class AnswerExerciseDto {
  /** Client-generated id; the same answerId is processed once (idempotent). */
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{8,64}$/)
  answerId!: string;

  /** Required (REVIEW B1): only items issued in this session can be answered. */
  @IsUUID()
  sessionId!: string;

  @IsUUID()
  vocabId!: string;

  @IsIn(EXERCISE_TYPES as unknown as string[])
  type!: ExerciseType;

  /** Typed text, or the chosen option for multiple-choice types. */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  answer?: string;

  @IsOptional()
  @IsIn(['again', 'hard', 'good', 'easy'])
  selfRating?: SrsRatingValue;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(3_600_000)
  responseMs?: number;

  @IsOptional()
  @IsBoolean()
  hintUsed?: boolean;

  @IsOptional()
  @IsBoolean()
  extra?: boolean;
}

export class AudioDto {
  @IsUUID()
  vocabId!: string;
}
