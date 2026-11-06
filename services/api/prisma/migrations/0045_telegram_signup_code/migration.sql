-- One-time code the bot sends before a Telegram mini-app account is created.

ALTER TABLE "telegram_pending_signups" ADD COLUMN "code_hash" TEXT;
ALTER TABLE "telegram_pending_signups" ADD COLUMN "code_expires_at" TIMESTAMP(3);
ALTER TABLE "telegram_pending_signups" ADD COLUMN "code_attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "telegram_pending_signups" ADD COLUMN "code_sent_at" TIMESTAMP(3);
