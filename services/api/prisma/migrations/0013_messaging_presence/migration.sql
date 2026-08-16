-- Peer presence for Telegram-style online / last seen
ALTER TABLE "users" ADD COLUMN "last_seen_at" TIMESTAMP(3);
