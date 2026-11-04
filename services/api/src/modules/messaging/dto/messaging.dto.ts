import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { AppLanguage, UserReportReason } from '@prisma/client';

export class StartConversationDto {
  @IsUUID()
  peerUserId!: string;

  @IsOptional()
  @IsEnum(AppLanguage)
  language?: AppLanguage;

  @IsOptional()
  @IsUUID()
  contentId?: string;
}

export class SendMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  translation?: string;

  @IsOptional()
  @IsEnum(AppLanguage)
  bodyLang?: AppLanguage;

  @IsOptional()
  @IsUUID()
  replyToId?: string;
}

export class MarkReadDto {
  @IsOptional()
  @IsUUID()
  messageId?: string;
}

export class TypingDto {
  @IsOptional()
  @IsBoolean()
  typing?: boolean;
}

export class EditMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  translation?: string;

  @IsOptional()
  @IsEnum(AppLanguage)
  bodyLang?: AppLanguage;
}

/** P3b report & block. */
export class ReportUserDto {
  @IsUUID()
  reportedUserId!: string;

  @IsEnum(UserReportReason)
  reason!: UserReportReason;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  details?: string;

  @IsOptional()
  @IsUUID()
  messageId?: string;

  @IsOptional()
  @IsUUID()
  conversationId?: string;

  @IsOptional()
  @IsBoolean()
  alsoBlock?: boolean;
}
