-- CreateEnum
CREATE TYPE "ImportPaymentStatus" AS ENUM ('pending', 'paid', 'failed', 'expired', 'refunded');

-- AlterTable: widen page tier price for UZS amounts
ALTER TABLE "import_page_tiers" ALTER COLUMN "price_usd" TYPE DECIMAL(12,2);

-- CreateTable
CREATE TABLE "import_payments" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "ImportPaymentStatus" NOT NULL DEFAULT 'pending',
    "import_type" "ImportType" NOT NULL,
    "content_format" TEXT NOT NULL,
    "estimated_pages" INTEGER NOT NULL,
    "tier_id" UUID,
    "amount_tiyins" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'UZS',
    "provider" TEXT NOT NULL DEFAULT 'atmos',
    "account" TEXT NOT NULL,
    "provider_payment_id" TEXT,
    "provider_invoice_token" TEXT,
    "payment_url" TEXT,
    "ofd_url" TEXT,
    "user_import_id" UUID,
    "raw_create_json" JSONB,
    "raw_callback_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "import_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "import_payments_account_key" ON "import_payments"("account");

-- CreateIndex
CREATE INDEX "import_payments_user_id_status_idx" ON "import_payments"("user_id", "status");

-- CreateIndex
CREATE INDEX "import_payments_provider_payment_id_idx" ON "import_payments"("provider_payment_id");

-- AddForeignKey
ALTER TABLE "import_payments" ADD CONSTRAINT "import_payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
