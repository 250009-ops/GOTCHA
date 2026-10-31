-- payments-02 (Sarvarbek 14:18): separate per-plan chapter-quiz cap, admin-editable.
-- Free 10/day, Plus 200/day. Lookups stay on ai_daily_quota (Free 20, Plus 200: see data-fixes/2026-10-31-plus-price-uzs.sql).
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "quiz_daily_quota" INTEGER NOT NULL DEFAULT 10;
-- Code defaults match without the seed (14:24): new plan rows default to Free caps.
ALTER TABLE "subscription_plans" ALTER COLUMN "ai_daily_quota" SET DEFAULT 20;
UPDATE "subscription_plans" SET "quiz_daily_quota" = 200 WHERE "tier" = 'premium' AND "quiz_daily_quota" = 10;
