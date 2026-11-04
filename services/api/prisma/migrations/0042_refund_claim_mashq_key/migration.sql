-- B2: refund retries can be claimed and capped. A timeout never returns the row to paid.
ALTER TABLE "import_payments" ADD COLUMN IF NOT EXISTS "refund_attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "import_payments" ADD COLUMN IF NOT EXISTS "reconcile_locked_until" TIMESTAMPTZ;

-- M2: Mashq idempotency is per user, bound to the request, and ignored after 24 hours.
ALTER TABLE "practice_sessions" ADD COLUMN IF NOT EXISTS "request_hash" TEXT;
DROP INDEX IF EXISTS "practice_sessions_idempotency_key_key";
CREATE UNIQUE INDEX IF NOT EXISTS "practice_sessions_user_id_idempotency_key_key"
  ON "practice_sessions"("user_id", "idempotency_key");
