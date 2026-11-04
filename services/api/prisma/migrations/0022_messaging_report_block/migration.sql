-- P3b: messaging report & block (Play UGC policy). Additive; safe on a live DB.
CREATE TYPE "UserReportReason" AS ENUM ('spam', 'harassment', 'inappropriate', 'underage', 'other');
CREATE TYPE "UserReportStatus" AS ENUM ('open', 'reviewed', 'actioned', 'dismissed');

CREATE TABLE "user_blocks" (
  "blocker_id" UUID NOT NULL,
  "blocked_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_blocks_pkey" PRIMARY KEY ("blocker_id", "blocked_id")
);
CREATE INDEX "user_blocks_blocked_id_idx" ON "user_blocks"("blocked_id");
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocker_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocked_id_fkey" FOREIGN KEY ("blocked_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "user_reports" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "reporter_id" UUID NOT NULL,
  "reported_user_id" UUID NOT NULL,
  "conversation_id" UUID,
  "message_id" UUID,
  "reason" "UserReportReason" NOT NULL,
  "details" TEXT,
  "message_snapshot" TEXT,
  "status" "UserReportStatus" NOT NULL DEFAULT 'open',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewed_at" TIMESTAMP(3),
  CONSTRAINT "user_reports_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "user_reports_status_created_at_idx" ON "user_reports"("status", "created_at");
CREATE INDEX "user_reports_reported_user_id_idx" ON "user_reports"("reported_user_id");
ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_reported_user_id_fkey" FOREIGN KEY ("reported_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
