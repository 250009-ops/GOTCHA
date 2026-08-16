import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { AppLanguage } from '@prisma/client';

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
