-- WL4-14: schema says users.ui_language defaults to uz; the DB still had en from 0001. Default only, no data change.
ALTER TABLE "users" ALTER COLUMN "ui_language" SET DEFAULT 'uz';

-- WL4-10: TTS daily counter persisted per user/day (was in-process, reset on restart). Additive.
ALTER TABLE "ai_usage_daily" ADD COLUMN IF NOT EXISTS "tts_count" INTEGER NOT NULL DEFAULT 0;

-- WL4-11: account deletion keeps safety reports but drops the link to the deleted user (null reporter / reported user).
ALTER TABLE "user_reports" ALTER COLUMN "reporter_id" DROP NOT NULL;
ALTER TABLE "user_reports" ALTER COLUMN "reported_user_id" DROP NOT NULL;
ALTER TABLE "user_reports" DROP CONSTRAINT IF EXISTS "user_reports_reporter_id_fkey";
ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "user_reports" DROP CONSTRAINT IF EXISTS "user_reports_reported_user_id_fkey";
ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_reported_user_id_fkey" FOREIGN KEY ("reported_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "content_reports" ALTER COLUMN "reporter_id" DROP NOT NULL;
ALTER TABLE "content_reports" DROP CONSTRAINT IF EXISTS "content_reports_reporter_id_fkey";
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
