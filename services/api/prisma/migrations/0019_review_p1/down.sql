-- Manual rollback (Prisma has no down migrations). The 'refunding' enum value cannot be dropped;
-- first move any refunding rows back to paid: UPDATE import_payments SET status='paid' WHERE status='refunding';
ALTER TABLE "user_preferences" DROP CONSTRAINT IF EXISTS "user_preferences_app_theme_check";
DROP TABLE IF EXISTS "practice_session_items";
DROP INDEX IF EXISTS "vocabulary_reviews_vocab_id_exercise_type_reviewed_at_idx";
DROP INDEX IF EXISTS "vocabulary_reviews_user_id_reviewed_at_idx";
ALTER TABLE "vocabulary_reviews" DROP COLUMN IF EXISTS "judged_by_ai", DROP COLUMN IF EXISTS "state_before", DROP COLUMN IF EXISTS "user_id";
DROP INDEX IF EXISTS "content_purchases_import_payment_id_key";
ALTER TABLE "content_purchases" DROP COLUMN IF EXISTS "import_payment_id";
DROP INDEX IF EXISTS "import_payments_status_refund_requested_at_idx";
ALTER TABLE "import_payments" DROP COLUMN IF EXISTS "needs_attention", DROP COLUMN IF EXISTS "cancel_reason",
  DROP COLUMN IF EXISTS "refund_requested_at", DROP COLUMN IF EXISTS "refund_requested_by", DROP COLUMN IF EXISTS "refund_reason";
