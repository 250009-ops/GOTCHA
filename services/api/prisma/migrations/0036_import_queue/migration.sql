-- 0036_import_queue (renumbered after final-5 0027-0029 in r3b; was 0033) (import-p0, rebased onto wlive dfe421f + payments-02 0027-0032; replaces import-p0's old 0030_import_queue).
-- PAY2-15: regenerated with `prisma migrate diff --from-migrations --to-schema-datamodel` on the combined line.
-- refund_reason / refund_requested_at already exist (wlive 0019_review_p1) and are reused, NOT re-added (old 0030 failed P3018).
-- Idempotent: every statement is IF NOT EXISTS / guarded, so it also applies on a DB that already ran the old import-p0 0030
-- (staging) — in that case resolve the old row with `prisma migrate resolve --rolled-back 0030_import_queue` first if it is marked failed.
-- Additive only: new tables + nullable/defaulted columns. Safe while the old API runs.

-- AlterTable
ALTER TABLE "import_payments" ADD COLUMN IF NOT EXISTS "refund_state" TEXT,
ADD COLUMN IF NOT EXISTS "refunded_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "user_imports" ADD COLUMN IF NOT EXISTS "manual_retries" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "notice_code" TEXT,
ADD COLUMN IF NOT EXISTS "notice_data" JSONB;

-- CreateTable
CREATE TABLE IF NOT EXISTS "import_queue_jobs" (
    "id" UUID NOT NULL,
    "user_import_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "run_after" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_by" TEXT,
    "locked_at" TIMESTAMP(3),
    "heartbeat_at" TIMESTAMP(3),
    "last_error" TEXT,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "import_queue_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "import_uploads" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "file_key" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "import_type" "ImportType" NOT NULL,
    "page_count" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),

    CONSTRAINT "import_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "import_queue_jobs_user_import_id_key" ON "import_queue_jobs"("user_import_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "import_queue_jobs_status_run_after_idx" ON "import_queue_jobs"("status", "run_after");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "import_queue_jobs_status_heartbeat_at_idx" ON "import_queue_jobs"("status", "heartbeat_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "import_uploads_user_id_created_at_idx" ON "import_uploads"("user_id", "created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "import_uploads_expires_at_idx" ON "import_uploads"("expires_at");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'import_queue_jobs_user_import_id_fkey') THEN
    ALTER TABLE "import_queue_jobs" ADD CONSTRAINT "import_queue_jobs_user_import_id_fkey" FOREIGN KEY ("user_import_id") REFERENCES "user_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
