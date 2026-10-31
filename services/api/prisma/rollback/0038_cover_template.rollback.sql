-- covers-01 ROLLBACK (manual; Prisma has no down migrations). Lossless: cover_image_key was never modified by 0038.
-- Step A (soft, recommended first): show original covers again for every book, keep the columns.
--   UPDATE "content_items" SET "cover_mode" = 'original' WHERE "original_cover_key" IS NOT NULL;
-- Step B (hard): remove the covers-01 columns and the migration record. Uploads made AFTER covers-01 stay in
-- cover_image_key (that is what pre-covers-01 code shows); to put the snapshotted original back first, run:
--   UPDATE "content_items" SET "cover_image_key" = "original_cover_key"
--    WHERE "original_cover_key" IS NOT NULL AND "cover_image_key" IS DISTINCT FROM "original_cover_key";
BEGIN;
ALTER TABLE "content_items" DROP CONSTRAINT IF EXISTS "content_items_cover_mode_check";
ALTER TABLE "content_items" DROP COLUMN IF EXISTS "cover_mode";
ALTER TABLE "content_items" DROP COLUMN IF EXISTS "original_cover_key";
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '0038_cover_template';
COMMIT;
