-- REVIEW-p2 PM7 (moved out of 0020_pricing): restore admin-configured values of plans that existed before 0020.
-- Only columns that existed before 0020 are restored; the new columns (name_i18n, features, ...) keep 0020's seed.
UPDATE "subscription_plans" sp SET
  "name" = b."name", "price_monthly" = b."price_monthly", "ai_daily_quota" = b."ai_daily_quota",
  "import_limit" = b."import_limit", "offline_enabled" = b."offline_enabled"
FROM "subscription_plans_backup_0020" b WHERE b."id" = sp."id";
