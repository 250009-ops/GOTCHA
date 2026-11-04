-- REVIEW-p2b N-M2: bounded, claimed reconciler retries of Atmos reversals.
ALTER TABLE "import_payments" ADD COLUMN "reconcile_attempts" INTEGER NOT NULL DEFAULT 0;
