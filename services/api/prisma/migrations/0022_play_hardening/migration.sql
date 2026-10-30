-- REVIEW-p2: RTDN replay protection, subscription linkage, job bookkeeping. Additive.
ALTER TABLE "play_purchases"
  ADD COLUMN IF NOT EXISTS "linked_token_hash" TEXT,
  ADD COLUMN IF NOT EXISTS "last_checked_at" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "play_purchases_pending_jobs_idx" ON "play_purchases" ("acknowledged", "consumed", "state", "created_at");

CREATE TABLE IF NOT EXISTS "play_rtdn_messages" (
  "message_id" TEXT NOT NULL,
  "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "play_rtdn_messages_pkey" PRIMARY KEY ("message_id")
);
CREATE INDEX IF NOT EXISTS "play_rtdn_messages_received_at_idx" ON "play_rtdn_messages" ("received_at");

-- m-p2-2: the column name is historical; it holds UZS (soʻm), not USD.
COMMENT ON COLUMN "import_page_tiers"."price_usd" IS 'Price in UZS (soʻm). Legacy column name; not USD.';
-- m-p2-3: for Play rows this is the configured store price, not the amount Google charged.
COMMENT ON COLUMN "import_payments"."amount_tiyins" IS 'Charged amount in tiyins. provider=google_play: configured store_products price (estimate; Play Console/Orders API is authoritative).';
