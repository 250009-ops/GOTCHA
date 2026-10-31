-- payments-02: a paid import must never end charged with no result.
-- import_attempts: failed attempts already released for a free retry on the same payment.
-- refund_due: retries used up (or retry unsafe); admin refunds via the reverse path.
ALTER TABLE "import_payments" ADD COLUMN IF NOT EXISTS "import_attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "import_payments" ADD COLUMN IF NOT EXISTS "refund_due" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "import_payments_refund_due_idx" ON "import_payments" ("refund_due") WHERE "refund_due";
