import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min, Length, Matches } from 'class-validator';
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

export class ImportPreApplyDto {
  @IsString()
  @Length(13, 19)
  @Matches(/^[0-9\s]+$/, { message: 'Card number must contain only digits' })
  cardNumber!: string;

  @IsString()
  @Length(4, 5)
  @Matches(/^[0-9\/]+$/, { message: 'Expiry must be in YYMM or YY/MM format' })
  expiry!: string;
}

export class ImportApplyDto {
  @IsString()
  @Length(4, 8)
  @Matches(/^[0-9\s]+$/, { message: 'OTP must contain only digits' })
  otp!: string;
}

export class ImportCancelDto {
  @IsOptional()
  @IsString()
  @Length(0, 500)
  reason?: string;
}
