-- Shared dictionary for catalog taps, and a generator tag on Mashq rows.
CREATE TABLE IF NOT EXISTS "word_dictionary" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "lemma" TEXT NOT NULL,
  "source_lang" "AppLanguage" NOT NULL,
  "senses" JSONB NOT NULL,
  "generator_version" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "word_dictionary_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "word_dictionary_lemma_source_lang_key"
  ON "word_dictionary" ("lemma", "source_lang");

ALTER TABLE "page_questions"
  ADD COLUMN IF NOT EXISTS "generator_version" TEXT NOT NULL DEFAULT 'legacy';

CREATE INDEX IF NOT EXISTS "ai_lookup_costs_created_at_idx"
  ON "ai_lookup_costs" ("created_at");
