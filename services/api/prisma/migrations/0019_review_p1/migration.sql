-- P1 review fixes (REVIEW-p1.md B1, B2, M2, M3, M5, M6, M8). Run with SET lock_timeout = '5s'.
-- Not reversible for the enum value (Postgres cannot drop enum values); see down.sql for the rest.
ALTER TYPE "ImportPaymentStatus" ADD VALUE IF NOT EXISTS 'refunding';

ALTER TABLE "import_payments"
  ADD COLUMN IF NOT EXISTS "refund_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "refund_requested_by" UUID,
  ADD COLUMN IF NOT EXISTS "refund_requested_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancel_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "needs_attention" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "import_payments_status_refund_requested_at_idx" ON "import_payments"("status", "refund_requested_at");

ALTER TABLE "content_purchases" ADD COLUMN IF NOT EXISTS "import_payment_id" UUID;
-- Backfill the link for existing Atmos purchases (providerRef = payment.provider_payment_id).
UPDATE "content_purchases" cp SET "import_payment_id" = p."id"
  FROM "import_payments" p
 WHERE cp."import_payment_id" IS NULL AND cp."provider" = 'atmos' AND cp."provider_ref" IS NOT NULL
   AND p."provider_payment_id" = cp."provider_ref" AND p."user_id" = cp."user_id"
   AND NOT EXISTS (SELECT 1 FROM "content_purchases" x WHERE x."import_payment_id" = p."id");
CREATE UNIQUE INDEX IF NOT EXISTS "content_purchases_import_payment_id_key" ON "content_purchases"("import_payment_id");

ALTER TABLE "vocabulary_reviews"
  ADD COLUMN IF NOT EXISTS "user_id" UUID,
  ADD COLUMN IF NOT EXISTS "state_before" INTEGER,
  ADD COLUMN IF NOT EXISTS "judged_by_ai" BOOLEAN NOT NULL DEFAULT false;
-- Backfill owner (batch this on large tables).
UPDATE "vocabulary_reviews" r SET "user_id" = v."user_id" FROM "user_vocabulary" v WHERE r."vocab_id" = v."id" AND r."user_id" IS NULL;
CREATE INDEX IF NOT EXISTS "vocabulary_reviews_user_id_reviewed_at_idx" ON "vocabulary_reviews"("user_id", "reviewed_at");
CREATE INDEX IF NOT EXISTS "vocabulary_reviews_vocab_id_exercise_type_reviewed_at_idx" ON "vocabulary_reviews"("vocab_id", "exercise_type", "reviewed_at");

CREATE TABLE IF NOT EXISTS "practice_session_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "session_id" UUID NOT NULL,
  "vocab_id" UUID NOT NULL,
  "type" TEXT NOT NULL,
  "extra" BOOLEAN NOT NULL DEFAULT false,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "requeue" BOOLEAN NOT NULL DEFAULT false,
  "answered_at" TIMESTAMP(3),
  CONSTRAINT "practice_session_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "practice_session_items_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "practice_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "practice_session_items_session_id_vocab_id_type_key" ON "practice_session_items"("session_id", "vocab_id", "type");

-- 0018 follow-up from review: constrain app_theme.
ALTER TABLE "user_preferences" DROP CONSTRAINT IF EXISTS "user_preferences_app_theme_check";
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_app_theme_check" CHECK ("app_theme" IN ('system','light','dark')) NOT VALID;
ALTER TABLE "user_preferences" VALIDATE CONSTRAINT "user_preferences_app_theme_check";
