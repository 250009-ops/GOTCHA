-- 0023 (31 Oct 2026, Lead): additive only. Age rating on content + optional birth year on users,
-- per-item glossary and comprehension questions (PM beginner-batch extras.json).
-- CreateEnum
CREATE TYPE "AgeRating" AS ENUM ('all_ages', 'teen_13', 'mature_18');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "birth_year" INTEGER;

-- AlterTable
ALTER TABLE "content_items" ADD COLUMN     "age_rating" "AgeRating" NOT NULL DEFAULT 'all_ages';

-- CreateTable
CREATE TABLE "content_glosses" (
    "id" UUID NOT NULL,
    "content_id" UUID NOT NULL,
    "chapter_index" INTEGER NOT NULL DEFAULT 0,
    "word" TEXT NOT NULL,
    "uz" TEXT,
    "ru" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_glosses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comprehension_questions" (
    "id" UUID NOT NULL,
    "content_id" UUID NOT NULL,
    "chapter_index" INTEGER NOT NULL DEFAULT 0,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'short_answer',
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comprehension_questions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "content_glosses_content_id_chapter_index_idx" ON "content_glosses"("content_id", "chapter_index");

-- CreateIndex
CREATE UNIQUE INDEX "content_glosses_content_id_word_key" ON "content_glosses"("content_id", "word");

-- CreateIndex
CREATE INDEX "comprehension_questions_content_id_chapter_index_idx" ON "comprehension_questions"("content_id", "chapter_index");

-- CreateIndex
CREATE UNIQUE INDEX "comprehension_questions_content_id_sort_order_key" ON "comprehension_questions"("content_id", "sort_order");

-- AddForeignKey
ALTER TABLE "content_glosses" ADD CONSTRAINT "content_glosses_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comprehension_questions" ADD CONSTRAINT "comprehension_questions_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

