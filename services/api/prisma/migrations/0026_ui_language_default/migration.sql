-- WL4-14: schema says users.ui_language defaults to uz; the DB still had en from 0001. Default only, no data change.
ALTER TABLE "users" ALTER COLUMN "ui_language" SET DEFAULT 'uz';

-- WL4-10: TTS daily counter persisted per user/day (was in-process, reset on restart). Additive.
ALTER TABLE "ai_usage_daily" ADD COLUMN IF NOT EXISTS "tts_count" INTEGER NOT NULL DEFAULT 0;
