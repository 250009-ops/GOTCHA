-- PAY2-12: persist the expiry sweeper backoff (next_check_at, attempts); index for the oldest-first sweep.
ALTER TABLE "import_payments" ADD COLUMN IF NOT EXISTS "expiry_check_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "next_check_at" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "import_payments_status_expires_at_idx" ON "import_payments"("status", "expires_at");
