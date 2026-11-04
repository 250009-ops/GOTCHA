-- Messaging privacy: presence opt-in, read cursor, typing, edit history, one report per user+message.

ALTER TABLE "user_preferences"
  ADD COLUMN "show_online_status" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "conversation_participants"
  ADD COLUMN "last_read_message_id" UUID,
  ADD COLUMN "typing_until" TIMESTAMP(3);

ALTER TABLE "messages"
  ADD COLUMN "original_body" TEXT;

-- Keep whatever text is still on the row as the original. Already-wiped deletes cannot be recovered.
UPDATE "messages"
SET "original_body" = "body"
WHERE "original_body" IS NULL AND "deleted_at" IS NULL AND "body" <> '';

CREATE TABLE "message_edits" (
  "id" UUID NOT NULL,
  "message_id" UUID NOT NULL,
  "body" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "message_edits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "message_edits_message_id_created_at_idx" ON "message_edits"("message_id", "created_at");

ALTER TABLE "message_edits"
  ADD CONSTRAINT "message_edits_message_id_fkey"
  FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Point the read cursor at the newest message the participant had already marked read by time.
UPDATE "conversation_participants" AS me
SET "last_read_message_id" = sub.id
FROM (
  SELECT DISTINCT ON (m.conversation_id, me2.user_id) m.conversation_id, me2.user_id, m.id
  FROM "conversation_participants" me2
  JOIN "messages" m ON m.conversation_id = me2.conversation_id
  WHERE me2.last_read_at IS NOT NULL
    AND m.created_at <= me2.last_read_at
  ORDER BY m.conversation_id, me2.user_id, m.created_at DESC
) AS sub
WHERE me.conversation_id = sub.conversation_id
  AND me.user_id = sub.user_id
  AND me.last_read_message_id IS NULL;

DELETE FROM "user_reports" a
USING "user_reports" b
WHERE a.message_id IS NOT NULL
  AND a.reporter_id IS NOT NULL
  AND a.reporter_id = b.reporter_id
  AND a.message_id = b.message_id
  AND a.created_at > b.created_at;

CREATE UNIQUE INDEX "user_reports_reporter_id_message_id_key"
  ON "user_reports"("reporter_id", "message_id");
