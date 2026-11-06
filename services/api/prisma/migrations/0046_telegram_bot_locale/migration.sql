-- Bot language is stored per Telegram id. Existing visitors stay on Uzbek.
ALTER TABLE "telegram_pending_signups" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'uz';
