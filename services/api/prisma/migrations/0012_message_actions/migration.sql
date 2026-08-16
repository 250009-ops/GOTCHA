-- Telegram-style reply / edit / delete on chat messages
ALTER TABLE "messages" ADD COLUMN "reply_to_id" UUID;
ALTER TABLE "messages" ADD COLUMN "edited_at" TIMESTAMP(3);
ALTER TABLE "messages" ADD COLUMN "deleted_at" TIMESTAMP(3);

CREATE INDEX "messages_reply_to_id_idx" ON "messages"("reply_to_id");

ALTER TABLE "messages" ADD CONSTRAINT "messages_reply_to_id_fkey"
  FOREIGN KEY ("reply_to_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
