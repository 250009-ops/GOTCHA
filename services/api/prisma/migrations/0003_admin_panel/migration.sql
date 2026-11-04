-- CreateEnum
CREATE TYPE "SupportTicketStatus" AS ENUM ('open', 'in_progress', 'waiting', 'resolved', 'closed');

-- CreateEnum
CREATE TYPE "SupportTicketPriority" AS ENUM ('low', 'medium', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('draft', 'scheduled', 'sending', 'sent', 'cancelled');

-- CreateEnum
CREATE TYPE "CampaignChannel" AS ENUM ('push', 'email', 'in_app');

-- CreateEnum
CREATE TYPE "AchievementCategory" AS ENUM ('streak', 'reading', 'vocabulary', 'social', 'special');

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'open',
    "priority" "SupportTicketPriority" NOT NULL DEFAULT 'medium',
    "category" TEXT NOT NULL DEFAULT 'general',
    "assignee_id" UUID,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_campaigns" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "channel" "CampaignChannel" NOT NULL DEFAULT 'push',
    "status" "CampaignStatus" NOT NULL DEFAULT 'draft',
    "audience" TEXT NOT NULL DEFAULT 'all',
    "scheduled_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievements" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "AchievementCategory" NOT NULL DEFAULT 'special',
    "icon_key" TEXT,
    "points" INTEGER NOT NULL DEFAULT 10,
    "threshold" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "language_catalog" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "native_name" TEXT NOT NULL,
    "flag_emoji" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "learner_count" INTEGER NOT NULL DEFAULT 0,
    "content_count" INTEGER NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "language_catalog_pkey" PRIMARY KEY ("code")
);

-- CreateIndex
CREATE INDEX "support_tickets_status_priority_idx" ON "support_tickets"("status", "priority");

-- CreateIndex
CREATE INDEX "notification_campaigns_status_idx" ON "notification_campaigns"("status");

-- CreateIndex
CREATE UNIQUE INDEX "achievements_code_key" ON "achievements"("code");
