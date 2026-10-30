-- DB-driven pricing: plan display/period/features/active, page-tier active flag, promo codes.
-- Seeds ONLY the non-PROPOSAL rows of team/PRICING.md §7 (v0.2). Safe to re-run.
ALTER TABLE "subscription_plans"
  ADD COLUMN IF NOT EXISTS "name_i18n" JSONB,
  ADD COLUMN IF NOT EXISTS "period" TEXT NOT NULL DEFAULT 'month',
  ADD COLUMN IF NOT EXISTS "features" JSONB,
  ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "subscription_plans" DROP CONSTRAINT IF EXISTS "subscription_plans_period_check";
ALTER TABLE "subscription_plans" ADD CONSTRAINT "subscription_plans_period_check" CHECK ("period" IN ('month','year','one_time'));

ALTER TABLE "import_page_tiers" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "import_payments"
  ADD COLUMN IF NOT EXISTS "promo_code_id" UUID,
  ADD COLUMN IF NOT EXISTS "list_amount_tiyins" INTEGER,
  ADD COLUMN IF NOT EXISTS "promo_redeemed" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "promo_codes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" TEXT NOT NULL,
  "description" TEXT,
  "percent_off" INTEGER,
  "amount_off_uzs" INTEGER,
  "applies_to" TEXT NOT NULL DEFAULT 'all',
  "valid_from" TIMESTAMP(3),
  "valid_to" TIMESTAMP(3),
  "max_redemptions" INTEGER,
  "redemptions" INTEGER NOT NULL DEFAULT 0,
  "per_user_limit" INTEGER NOT NULL DEFAULT 1,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "promo_codes_discount_check" CHECK (("percent_off" IS NULL) <> ("amount_off_uzs" IS NULL)),
  CONSTRAINT "promo_codes_percent_check" CHECK ("percent_off" IS NULL OR "percent_off" BETWEEN 1 AND 70),
  CONSTRAINT "promo_codes_amount_check" CHECK ("amount_off_uzs" IS NULL OR "amount_off_uzs" > 0),
  CONSTRAINT "promo_codes_applies_check" CHECK ("applies_to" IN ('imports','catalog','all'))
);
CREATE UNIQUE INDEX IF NOT EXISTS "promo_codes_code_key" ON "promo_codes"("code");

-- Seed (PRICING.md v0.2 §7): Free and Plus (tier premium). PROPOSAL rows (yearly, student, promos) are not seeded.
INSERT INTO "subscription_plans" ("id","tier","name","price_monthly","ai_daily_quota","import_limit","offline_enabled","name_i18n","period","features","active","sort_order")
VALUES
  (gen_random_uuid(),'free','Free',0,50,15,false,'{"en":"Free","ru":"Бесплатно","uz":"Bepul"}','month',
   '["reader","library","ai_lookup","translate","tts","vocabulary","srs_review","practice","imports_free_pool","stats","messaging"]',true,0),
  (gen_random_uuid(),'premium','Plus',34990,1000000,1000000,false,'{"en":"Plus","ru":"Plus","uz":"Plus"}','month',
   '["reader","library","ai_lookup_unlimited","translate","tts","vocabulary","srs_review","practice","imports_free_pool","stats","messaging"]',true,1)
ON CONFLICT ("tier") DO UPDATE SET
  "name" = EXCLUDED."name", "price_monthly" = EXCLUDED."price_monthly", "ai_daily_quota" = EXCLUDED."ai_daily_quota",
  "import_limit" = EXCLUDED."import_limit", "offline_enabled" = EXCLUDED."offline_enabled", "name_i18n" = EXCLUDED."name_i18n",
  "period" = EXCLUDED."period", "features" = EXCLUDED."features", "sort_order" = EXCLUDED."sort_order";
-- Page tiers: PRICING says keep current values; seed only when the table is empty.
INSERT INTO "import_page_tiers" ("id","label","min_pages","max_pages","price_usd","sort_order","updated_at")
SELECT gen_random_uuid(), v.label, v.min_pages, v.max_pages, v.price, v.sort, CURRENT_TIMESTAMP
FROM (VALUES ('1 - 10 pages',1,10,12000,1),('11 - 50 pages',11,50,29000,2),('51 - 100 pages',51,100,49000,3),('100+ pages',101,NULL::int,79000,4))
  AS v(label,min_pages,max_pages,price,sort)
WHERE NOT EXISTS (SELECT 1 FROM "import_page_tiers");
-- Other tiers (if any) are left untouched; their plan rows stay but can be deactivated in admin.
