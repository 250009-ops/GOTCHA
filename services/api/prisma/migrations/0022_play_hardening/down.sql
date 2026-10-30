DROP TABLE IF EXISTS "play_rtdn_messages";
DROP INDEX IF EXISTS "play_purchases_pending_jobs_idx";
ALTER TABLE "play_purchases" DROP COLUMN IF EXISTS "linked_token_hash", DROP COLUMN IF EXISTS "last_checked_at";
