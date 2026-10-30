-- Practice 2.0 (PRD-practice.md): FSRS state, single review log, XP / goals / streak freezes.
ALTER TYPE "PracticeType" ADD VALUE IF NOT EXISTS 'mixed';

ALTER TABLE "users" ADD COLUMN "xp_total" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "xp_today" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "xp_date" DATE;
ALTER TABLE "users" ADD COLUMN "streak_freezes" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "user_preferences" ADD COLUMN "daily_goal_xp" INTEGER NOT NULL DEFAULT 60;
ALTER TABLE "user_preferences" ADD COLUMN "daily_new_words" INTEGER NOT NULL DEFAULT 10;
-- Map the legacy minutes goal onto the XP goal ladder (15 min ≈ Regular 60).
UPDATE "user_preferences" SET "daily_goal_xp" = CASE
  WHEN "daily_goal_minutes" <= 10 THEN 30
  WHEN "daily_goal_minutes" <= 20 THEN 60
  WHEN "daily_goal_minutes" <= 40 THEN 120
  ELSE 200 END;

ALTER TABLE "user_vocabulary" ADD COLUMN "lapses" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "user_vocabulary" ADD COLUMN "stability" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "user_vocabulary" ADD COLUMN "difficulty" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "user_vocabulary" ADD COLUMN "fsrs_state" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "user_vocabulary" ADD COLUMN "learning_steps" INTEGER NOT NULL DEFAULT 0;
-- Seed FSRS from SM-2: reviewed cards become Review with S ≈ current interval; D from ease (2.5 → 5).
UPDATE "user_vocabulary" SET
  "fsrs_state" = 2,
  "stability" = GREATEST("interval_days", 1),
  "difficulty" = LEAST(10, GREATEST(1, 5 + (2.5 - "ease_factor") * 4))
WHERE "repetitions" > 0 OR "last_reviewed_at" IS NOT NULL;

ALTER TABLE "vocabulary_reviews" ADD COLUMN "exercise_type" TEXT;
ALTER TABLE "vocabulary_reviews" ADD COLUMN "correct" BOOLEAN;
ALTER TABLE "vocabulary_reviews" ADD COLUMN "response_ms" INTEGER;
ALTER TABLE "vocabulary_reviews" ADD COLUMN "answer_id" TEXT;
ALTER TABLE "vocabulary_reviews" ADD COLUMN "session_id" UUID;
ALTER TABLE "vocabulary_reviews" ADD COLUMN "verdict" TEXT;
ALTER TABLE "vocabulary_reviews" ADD COLUMN "xp" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "vocabulary_reviews" ADD COLUMN "stability_after" DOUBLE PRECISION;
ALTER TABLE "vocabulary_reviews" ADD COLUMN "extra" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "vocabulary_reviews_answer_id_key" ON "vocabulary_reviews" ("answer_id");
CREATE INDEX "vocabulary_reviews_reviewed_at_idx" ON "vocabulary_reviews" ("reviewed_at");
CREATE INDEX "vocabulary_reviews_session_id_idx" ON "vocabulary_reviews" ("session_id");
