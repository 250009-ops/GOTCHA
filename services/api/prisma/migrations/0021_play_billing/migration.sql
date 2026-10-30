-- Google Play Billing + unified entitlements. Additive; safe on a live DB.
CREATE TYPE "PurchaseSource" AS ENUM ('atmos', 'google_play', 'admin');
CREATE TYPE "StorePlatform" AS ENUM ('web', 'google_play');
CREATE TYPE "StoreProductKind" AS ENUM ('subscription', 'import_tier', 'catalog_book');
CREATE TYPE "EntitlementKind" AS ENUM ('plus', 'catalog_book', 'import_credit');
CREATE TYPE "EntitlementStatus" AS ENUM ('active', 'expired', 'revoked');

CREATE TABLE "store_products" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "platform" "StorePlatform" NOT NULL,
  "sku" TEXT NOT NULL,
  "kind" "StoreProductKind" NOT NULL,
  "plan_tier" "SubscriptionTier",
  "import_tier_id" UUID,
  "content_id" UUID,
  "price_uzs" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "store_products_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "store_products_price_check" CHECK ("price_uzs" >= 0)
);
CREATE UNIQUE INDEX "store_products_platform_sku_key" ON "store_products"("platform", "sku");
CREATE INDEX "store_products_kind_content_id_idx" ON "store_products"("kind", "content_id");

CREATE TABLE "entitlements" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "kind" "EntitlementKind" NOT NULL,
  "source" "PurchaseSource" NOT NULL,
  "source_ref" TEXT NOT NULL,
  "sku" TEXT,
  "content_id" UUID,
  "import_payment_id" UUID,
  "status" "EntitlementStatus" NOT NULL DEFAULT 'active',
  "starts_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3),
  "revoked_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "entitlements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "entitlements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "entitlements_source_source_ref_kind_key" ON "entitlements"("source", "source_ref", "kind");
CREATE INDEX "entitlements_user_id_status_idx" ON "entitlements"("user_id", "status");

CREATE TABLE "play_purchases" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "token_hash" TEXT NOT NULL,
  "purchase_token" TEXT NOT NULL,
  "user_id" UUID NOT NULL,
  "sku" TEXT NOT NULL,
  "kind" "StoreProductKind" NOT NULL,
  "order_id" TEXT,
  "state" TEXT NOT NULL,
  "acknowledged" BOOLEAN NOT NULL DEFAULT false,
  "consumed" BOOLEAN NOT NULL DEFAULT false,
  "expiry_time" TIMESTAMP(3),
  "auto_renewing" BOOLEAN,
  "raw" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "play_purchases_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "play_purchases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "play_purchases_token_hash_key" ON "play_purchases"("token_hash");
CREATE INDEX "play_purchases_user_id_idx" ON "play_purchases"("user_id");
CREATE INDEX "play_purchases_order_id_idx" ON "play_purchases"("order_id");

-- Backfill the ledger from existing Atmos-era access rows.
INSERT INTO "entitlements" ("user_id", "kind", "source", "source_ref", "content_id", "import_payment_id", "starts_at")
SELECT cp."user_id", 'catalog_book', 'atmos', COALESCE(cp."import_payment_id"::text, 'cp:' || cp."id"::text), cp."content_id", cp."import_payment_id", cp."created_at"
FROM "content_purchases" cp
WHERE cp."user_id" IS NOT NULL AND cp."status" = 'completed'
ON CONFLICT DO NOTHING;

INSERT INTO "entitlements" ("user_id", "kind", "source", "source_ref", "expires_at", "starts_at")
SELECT us."user_id", 'plus', CASE WHEN us."provider" = 'atmos' THEN 'atmos'::"PurchaseSource" ELSE 'admin'::"PurchaseSource" END,
       'sub:' || us."id"::text, us."current_period_end", us."created_at"
FROM "user_subscriptions" us JOIN "subscription_plans" sp ON sp."id" = us."plan_id"
WHERE us."status" = 'active' AND sp."tier" = 'premium'
ON CONFLICT DO NOTHING;

-- Play SKUs proposed in PRICING.md §6 (PROPOSAL ids). Inactive until created in Play Console
-- and switched on in Admin → Pricing → Store products. Prices = web list price (fee absorbed).
INSERT INTO "store_products" ("platform", "sku", "kind", "plan_tier", "price_uzs", "active")
VALUES ('google_play', 'plus_monthly', 'subscription', 'premium', 34990, false)
ON CONFLICT DO NOTHING;
INSERT INTO "store_products" ("platform", "sku", "kind", "import_tier_id", "price_uzs", "active")
SELECT 'google_play', 'import_tier_' || t."min_pages" || '_' || COALESCE(t."max_pages"::text, 'plus'), 'import_tier', t."id", ROUND(t."price_usd")::int, false
FROM "import_page_tiers" t
ON CONFLICT DO NOTHING;
