import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsObject, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';

export class PlanUpdateDto {
  @IsOptional() @IsObject() nameI18n?: { en: string; ru?: string; uz?: string };
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100_000_000) priceUzs?: number;
  @IsOptional() @IsIn(['month', 'year', 'one_time']) period?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1_000_000) aiDailyQuota?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1_000_000) importLimit?: number;
  @IsOptional() @IsBoolean() offlineEnabled?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) features?: string[];
  @IsOptional() @IsBoolean() active?: boolean;
}

export class PromoDto {
  @IsOptional() @IsString() @Matches(/^[A-Za-z0-9_-]{3,32}$/) code?: string;
  @IsOptional() @IsString() @MaxLength(200) description?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @Type(() => Number) @IsInt() @Min(1) @Max(70) percentOff?: number | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @Type(() => Number) @IsInt() @Min(1) amountOffUzs?: number | null;
  @IsOptional() @IsIn(['imports', 'catalog', 'all']) appliesTo?: string;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsDateString() validFrom?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsDateString() validTo?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @Type(() => Number) @IsInt() @Min(1) maxRedemptions?: number | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) perUserLimit?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class StoreProductDto {
  @IsIn(['web', 'google_play']) platform!: 'web' | 'google_play';
  @IsString() @Matches(/^[a-z0-9][a-z0-9._]{0,98}$/) sku!: string;
  @IsIn(['subscription', 'import_tier', 'catalog_book']) kind!: 'subscription' | 'import_tier' | 'catalog_book';
  @IsOptional() @IsIn(['free', 'premium']) planTier?: string | null;
  @IsOptional() @IsString() importTierId?: string | null;
  @IsOptional() @IsString() contentId?: string | null;
  @Type(() => Number) @IsInt() @Min(0) @Max(100_000_000) priceUzs!: number;
  @IsOptional() @IsBoolean() active?: boolean;
}
