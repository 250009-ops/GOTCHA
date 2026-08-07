-- Gotcha schema v2: enums, known words, bookmarks, placement

CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'trialing', 'past_due', 'canceled');
CREATE TYPE "ModerationStatus" AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE "ImportType" AS ENUM ('paste', 'url', 'pdf', 'epub');
CREATE TYPE "IngestionSourceType" AS ENUM ('url', 'pdf', 'epub', 'gutenberg', 'cms', 'paste');
CREATE TYPE "WordStatus" AS ENUM ('unknown', 'learning', 'known', 'ignored');

ALTER TABLE "user_subscriptions" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "user_subscriptions"
  ALTER COLUMN "status" TYPE "SubscriptionStatus" USING ("status"::"SubscriptionStatus");
ALTER TABLE "user_subscriptions" ALTER COLUMN "status" SET DEFAULT 'active';

ALTER TABLE "user_imports" ALTER COLUMN "import_type" TYPE "ImportType" USING ("import_type"::"ImportType");
ALTER TABLE "ingestion_jobs" ALTER COLUMN "source_type" TYPE "IngestionSourceType" USING ("source_type"::"IngestionSourceType");
ALTER TABLE "moderation_queue" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "moderation_queue"
  ALTER COLUMN "status" TYPE "ModerationStatus" USING ("status"::"ModerationStatus");
ALTER TABLE "moderation_queue" ALTER COLUMN "status" SET DEFAULT 'pending';

CREATE TABLE "user_known_words" (
  "user_id" UUID NOT NULL,
  "lemma" TEXT NOT NULL,
  "source_lang" "AppLanguage" NOT NULL,
  "status" "WordStatus" NOT NULL DEFAULT 'learning',
  "first_seen_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "user_known_words_pkey" PRIMARY KEY ("user_id","lemma","source_lang")
);
ALTER TABLE "user_known_words" ADD CONSTRAINT "user_known_words_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "user_known_words_user_id_source_lang_status_idx"
  ON "user_known_words"("user_id", "source_lang", "status");

CREATE TABLE "content_bookmarks" (
  "user_id" UUID NOT NULL,
  "content_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "content_bookmarks_pkey" PRIMARY KEY ("user_id","content_id")
);
ALTER TABLE "content_bookmarks" ADD CONSTRAINT "content_bookmarks_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "content_bookmarks" ADD CONSTRAINT "content_bookmarks_content_id_fkey"
  FOREIGN KEY ("content_id") REFERENCES "content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "placement_results" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "target_language" "AppLanguage" NOT NULL,
  "suggested_level" "CefrLevel" NOT NULL,
  "score" DOUBLE PRECISION NOT NULL,
  "sample_content_id" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "placement_results_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "placement_results_user_id_target_language_idx"
  ON "placement_results"("user_id", "target_language");
