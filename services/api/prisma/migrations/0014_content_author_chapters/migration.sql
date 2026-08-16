ALTER TABLE "content_items" ADD COLUMN "author" TEXT;

ALTER TABLE "content_segments" ADD COLUMN "chapter_index" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "content_segments" ADD COLUMN "chapter_title" TEXT;
ALTER TABLE "content_segments" ADD COLUMN "page_index" INTEGER NOT NULL DEFAULT 0;
