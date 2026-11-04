-- round-3b WLF-13 (S2): an admin hard delete must NEVER delete payment records. The user FK on import_payments,
-- entitlements and play_purchases changes CASCADE -> RESTRICT (content_purchases.user_id is already SET NULL).
-- Non-destructive and idempotent: only the FK action changes; no rows are read, changed or deleted.
-- AdminService.hardDeleteUser anonymises + purges a payer instead of deleting the row (the FK is the DB backstop).
ALTER TABLE "import_payments" DROP CONSTRAINT IF EXISTS "import_payments_user_id_fkey";
ALTER TABLE "import_payments" ADD CONSTRAINT "import_payments_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "entitlements" DROP CONSTRAINT IF EXISTS "entitlements_user_id_fkey";
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "play_purchases" DROP CONSTRAINT IF EXISTS "play_purchases_user_id_fkey";
ALTER TABLE "play_purchases" ADD CONSTRAINT "play_purchases_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
