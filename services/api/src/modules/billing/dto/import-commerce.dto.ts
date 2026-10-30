import { Transform, Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min, Length, Matches, MaxLength, ValidateNested } from 'class-validator';
import { ImportType } from '@prisma/client';

export class ImportQuoteDto {
  /** Admin-managed promo code (PricingService); validated server-side. */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  promoCode?: string;

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
  @Max(4000)
  pageCount?: number;
}

export class CatalogCheckoutDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  promoCode?: string;
}

export class ImportCheckoutDto extends ImportQuoteDto {
  @IsOptional()
  @IsIn(['web', 'android'])
  platform?: 'web' | 'android';
}

export class ImportPreApplyDto {
  @IsString()
  @Length(16, 23)
  @Matches(/^[0-9\s]+$/, { message: 'Card number must contain only digits' })
  cardNumber!: string;

  @IsString()
  @Length(4, 5)
  @Matches(/^[0-9\/]+$/, { message: 'Expiry must be in MM/YY format (e.g. 03/30)' })
  expiry!: string;
}

export class ImportApplyDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/\s+/g, '') : value))
  @IsString()
  @Length(4, 8)
  @Matches(/^[0-9]+$/, { message: 'OTP must contain only digits' })
  otp!: string;
}

export class ImportCancelDto {
  @IsOptional()
  @IsString()
  @Length(0, 500)
  reason?: string;
}

/** Android → server after a Play purchase; the server re-verifies the token with Google. */
export class VerifyPlayPurchaseDto {
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9._]{0,98}$/)
  sku!: string;

  @IsString()
  @Length(10, 4096)
  purchaseToken!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ImportQuoteDto)
  importQuote?: ImportQuoteDto;
}
