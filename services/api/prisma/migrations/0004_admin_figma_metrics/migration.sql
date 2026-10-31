-- Expand AppLanguage for Figma Languages / Content catalog (fr, es, ja, de, ko, pt)
ALTER TYPE "AppLanguage" ADD VALUE IF NOT EXISTS 'fr';
ALTER TYPE "AppLanguage" ADD VALUE IF NOT EXISTS 'es';
ALTER TYPE "AppLanguage" ADD VALUE IF NOT EXISTS 'ja';
ALTER TYPE "AppLanguage" ADD VALUE IF NOT EXISTS 'de';
ALTER TYPE "AppLanguage" ADD VALUE IF NOT EXISTS 'ko';
ALTER TYPE "AppLanguage" ADD VALUE IF NOT EXISTS 'pt';

-- Language catalog Figma fields
ALTER TABLE "language_catalog" ADD COLUMN IF NOT EXISTS "region_label" TEXT;
ALTER TABLE "language_catalog" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'Active';
ALTER TABLE "language_catalog" ADD COLUMN IF NOT EXISTS "cefr_coverage" INTEGER NOT NULL DEFAULT 0;
