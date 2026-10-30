-- Persist lifetime best streak separately from the live consecutive counter.
ALTER TABLE "users" ADD COLUMN "best_streak" INTEGER NOT NULL DEFAULT 0;

UPDATE "users"
SET "best_streak" = GREATEST("streak_count", 0)
WHERE "best_streak" = 0;
