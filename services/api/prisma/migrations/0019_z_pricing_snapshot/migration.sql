-- REVIEW-p2b: 0020_pricing is kept byte-identical to what p2 shipped (checksums stay valid). Its seed overwrites
-- existing plan rows, so this migration (sorted just before 0020) snapshots subscription_plans first, and
-- 0020_pricing_z_restore puts admin-configured values back right after 0020 runs.
-- On a DB that already applied 0020, `migrate deploy` applies this late; the snapshot then holds the current
-- values and the restore is a no-op.
CREATE TABLE IF NOT EXISTS "subscription_plans_backup_0020" AS SELECT * FROM "subscription_plans";
