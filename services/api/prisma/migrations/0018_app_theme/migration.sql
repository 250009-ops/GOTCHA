-- App-wide theme preference (system | light | dark). Rollback: ALTER TABLE "user_preferences" DROP COLUMN "app_theme";
ALTER TABLE "user_preferences" ADD COLUMN IF NOT EXISTS "app_theme" TEXT NOT NULL DEFAULT 'system';
