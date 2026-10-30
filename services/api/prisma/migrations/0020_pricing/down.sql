-- Manual rollback for 0020_pricing (Prisma has no down migrations). pg_dump promo_codes first if it has data.
ALTER TABLE "import_payments" DROP COLUMN IF EXISTS "promo_code_id", DROP COLUMN IF EXISTS "list_amount_tiyins", DROP COLUMN IF EXISTS "promo_redeemed";
DROP TABLE IF EXISTS "promo_codes";
ALTER TABLE "import_page_tiers" DROP COLUMN IF EXISTS "active";
ALTER TABLE "subscription_plans" DROP CONSTRAINT IF EXISTS "subscription_plans_period_check";
ALTER TABLE "subscription_plans"
  DROP COLUMN IF EXISTS "name_i18n", DROP COLUMN IF EXISTS "period", DROP COLUMN IF EXISTS "features",
  DROP COLUMN IF EXISTS "active", DROP COLUMN IF EXISTS "sort_order", DROP COLUMN IF EXISTS "updated_at";
-- Restore plan values from the snapshot taken by the up migration (rows inserted by 0020 are removed).
DELETE FROM "subscription_plans" sp WHERE NOT EXISTS (SELECT 1 FROM "subscription_plans_backup_0020" b WHERE b."id" = sp."id")
  AND NOT EXISTS (SELECT 1 FROM "user_subscriptions" us WHERE us."plan_id" = sp."id");
UPDATE "subscription_plans" sp SET "name" = b."name", "price_monthly" = b."price_monthly", "ai_daily_quota" = b."ai_daily_quota",
  "import_limit" = b."import_limit", "offline_enabled" = b."offline_enabled"
FROM "subscription_plans_backup_0020" b WHERE b."id" = sp."id";
DROP TABLE IF EXISTS "subscription_plans_backup_0020";
