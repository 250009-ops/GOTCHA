-- covers-01: template book covers (landing covers-v2 style, drawn in code; no AI, no images, no storage).
-- ADDITIVE + IDEMPOTENT. Nothing is deleted or overwritten:
--   * cover_image_key is NEVER modified (it stays the exact pre-migration value, file untouched on disk).
--   * original_cover_key = a frozen copy of cover_image_key, written only where it is still NULL.
--   * cover_mode: 'template' (code-drawn cover) | 'upload' (admin upload in cover_image_key) | 'original' (original_cover_key).
-- Backfill: every existing book (catalog + user imports, so also every 'continue reading' hero) -> 'template'.
-- Per-book revert: UPDATE content_items SET cover_mode='original' WHERE id=...  (or Admin -> "Revert to original").
-- Full rollback: see rollback.sql in the covers-01 handoff (sets mode back / drops the two columns; cover_image_key unchanged).
ALTER TABLE "content_items" ADD COLUMN IF NOT EXISTS "original_cover_key" TEXT;
ALTER TABLE "content_items" ADD COLUMN IF NOT EXISTS "cover_mode" TEXT;

-- Snapshot originals (only rows not yet snapshotted; re-running is a no-op).
UPDATE "content_items" SET "original_cover_key" = "cover_image_key"
 WHERE "original_cover_key" IS NULL AND "cover_image_key" IS NOT NULL AND "cover_mode" IS NULL;

-- Backfill mode (only rows that have none yet; an admin's later choice is never reset by a re-run).
UPDATE "content_items" SET "cover_mode" = 'template' WHERE "cover_mode" IS NULL;

ALTER TABLE "content_items" ALTER COLUMN "cover_mode" SET DEFAULT 'template';
ALTER TABLE "content_items" ALTER COLUMN "cover_mode" SET NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'content_items_cover_mode_check') THEN
    ALTER TABLE "content_items" ADD CONSTRAINT "content_items_cover_mode_check"
      CHECK ("cover_mode" IN ('template', 'upload', 'original'));
  END IF;
END $$;
