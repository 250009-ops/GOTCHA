-- payments-02 (Sarvarbek 14:32): per-lookup cost log (Plus lookups have no daily cap by default).
-- One row per word lookup: model, tokens, estimated USD cost, plan, cache hit, mode. No lookup text is stored.
CREATE TABLE IF NOT EXISTS "ai_lookup_costs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "usage_date" DATE NOT NULL,
  "plan" TEXT NOT NULL,
  "mode" TEXT NOT NULL,
  "cache_hit" BOOLEAN NOT NULL DEFAULT false,
  "model" TEXT,
  "prompt_tokens" INTEGER NOT NULL DEFAULT 0,
  "completion_tokens" INTEGER NOT NULL DEFAULT 0,
  "est_cost_usd" DECIMAL(12,6) NOT NULL DEFAULT 0,
  CONSTRAINT "ai_lookup_costs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ai_lookup_costs_usage_date_idx" ON "ai_lookup_costs" ("usage_date");
CREATE INDEX IF NOT EXISTS "ai_lookup_costs_user_id_usage_date_idx" ON "ai_lookup_costs" ("user_id", "usage_date");
