-- Mashq page bank: questions served from a page, counted separately from the chapter quiz.
-- Also turns pronunciation back on. The speaker toggle did nothing until it was wired,
-- so a stored "off" is not a choice the learner made.

ALTER TABLE "ai_usage_daily" ADD COLUMN IF NOT EXISTS "mashq_question_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "content_segments" ADD COLUMN IF NOT EXISTS "quiz_ready_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "practice_sessions" ADD COLUMN IF NOT EXISTS "idempotency_key" TEXT;
ALTER TABLE "practice_questions" ADD COLUMN IF NOT EXISTS "page_question_id" UUID;

CREATE UNIQUE INDEX IF NOT EXISTS "practice_sessions_idempotency_key_key" ON "practice_sessions"("idempotency_key");

CREATE TABLE IF NOT EXISTS "page_questions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "segment_id" UUID NOT NULL,
  "content_id" UUID NOT NULL,
  "segment_hash" TEXT NOT NULL,
  "prompt_i18n" JSONB NOT NULL,
  "options_i18n" JSONB NOT NULL,
  "answer_index" INTEGER NOT NULL,
  "evidence_start" INTEGER NOT NULL DEFAULT 0,
  "evidence_end" INTEGER NOT NULL DEFAULT 0,
  "evidence_quote" TEXT NOT NULL,
  "explanation_i18n" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "times_served" INTEGER NOT NULL DEFAULT 0,
  "times_correct" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "page_questions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "page_question_seen" (
  "user_id" UUID NOT NULL,
  "question_id" UUID NOT NULL,
  "correct" BOOLEAN,
  "seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "page_question_seen_pkey" PRIMARY KEY ("user_id", "question_id")
);

CREATE INDEX IF NOT EXISTS "page_questions_segment_id_status_idx" ON "page_questions"("segment_id", "status");
CREATE INDEX IF NOT EXISTS "page_questions_content_id_status_idx" ON "page_questions"("content_id", "status");
CREATE INDEX IF NOT EXISTS "page_question_seen_user_id_seen_at_idx" ON "page_question_seen"("user_id", "seen_at");

DO $$ BEGIN
  ALTER TABLE "page_questions" ADD CONSTRAINT "page_questions_segment_id_fkey"
    FOREIGN KEY ("segment_id") REFERENCES "content_segments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "page_question_seen" ADD CONSTRAINT "page_question_seen_question_id_fkey"
    FOREIGN KEY ("question_id") REFERENCES "page_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "practice_questions" ADD CONSTRAINT "practice_questions_page_question_id_fkey"
    FOREIGN KEY ("page_question_id") REFERENCES "page_questions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

UPDATE "user_preferences" SET "tts_enabled" = true WHERE "tts_enabled" = false;
