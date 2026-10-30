-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('pending', 'completed', 'failed', 'refunded');

-- AlterTable
ALTER TABLE "content_items" ADD COLUMN "is_free" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "content_items" ADD COLUMN "price_usd" DECIMAL(10,2);
ALTER TABLE "content_items" ADD COLUMN "sales_count" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "content_purchases" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "content_id" UUID NOT NULL,
    "amount_usd" DECIMAL(10,2) NOT NULL,
    "status" "PurchaseStatus" NOT NULL DEFAULT 'pending',
    "provider" TEXT NOT NULL DEFAULT 'local_placeholder',
    "provider_ref" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_pricing_rules" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "price_per_import" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "price_per_page" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_pricing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_page_tiers" (
    "id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "min_pages" INTEGER NOT NULL,
    "max_pages" INTEGER,
    "price_usd" DECIMAL(10,2) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_page_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "content_purchases_content_id_status_idx" ON "content_purchases"("content_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "import_pricing_rules_key_key" ON "import_pricing_rules"("key");

-- AddForeignKey
ALTER TABLE "content_purchases" ADD CONSTRAINT "content_purchases_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_purchases" ADD CONSTRAINT "content_purchases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
