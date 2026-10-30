-- Manual rollback for 0018.
ALTER TABLE "user_preferences" DROP COLUMN IF EXISTS "app_theme";
