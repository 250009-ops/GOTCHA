-- 0024 (31 Oct 2026, Lead): web launch safety. Additive only; applies on live 0016 (+0022/0023) and on gotcha-fix 0023.
-- S3 sign-up consent record, S7 per-account AI-off switch, W-12 one-time age prompt,
-- S6a friend requests (messaging gate for 13-17), S6b content reports.

-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "ai_disabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "consent_version" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "consent_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "consent_ip" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "age_prompted_at" TIMESTAMP(3);

-- CreateEnum
CREATE TYPE "FriendRequestStatus" AS ENUM ('pending', 'accepted', 'declined');
CREATE TYPE "ContentReportStatus" AS ENUM ('open', 'reviewed', 'actioned', 'dismissed');

-- CreateTable
CREATE TABLE "friend_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "requester_id" UUID NOT NULL,
    "addressee_id" UUID NOT NULL,
    "status" "FriendRequestStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMP(3),
    CONSTRAINT "friend_requests_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "friend_requests_not_self" CHECK ("requester_id" <> "addressee_id")
);
CREATE UNIQUE INDEX "friend_requests_requester_id_addressee_id_key" ON "friend_requests"("requester_id", "addressee_id");
CREATE INDEX "friend_requests_addressee_id_status_idx" ON "friend_requests"("addressee_id", "status");
ALTER TABLE "friend_requests" ADD CONSTRAINT "friend_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "friend_requests" ADD CONSTRAINT "friend_requests_addressee_id_fkey" FOREIGN KEY ("addressee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "content_reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reporter_id" UUID NOT NULL,
    "content_id" UUID,
    "import_id" UUID,
    "reason" "UserReportReason" NOT NULL,
    "details" TEXT,
    "status" "ContentReportStatus" NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),
    CONSTRAINT "content_reports_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "content_reports_status_created_at_idx" ON "content_reports"("status", "created_at");
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
