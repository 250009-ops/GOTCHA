ALTER TABLE "ai_lookup_costs" ADD COLUMN "cached_prompt_tokens" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ai_lookup_costs" ADD COLUMN "latency_ms" INTEGER;
