-- CreateTable
CREATE TABLE "user_notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT,
    "ref_id" TEXT,
    "dedupe_key" TEXT NOT NULL,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_notifications_user_id_dedupe_key_key" ON "user_notifications"("user_id", "dedupe_key");

-- CreateIndex
CREATE INDEX "user_notifications_user_id_created_at_idx" ON "user_notifications"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "user_notifications_user_id_read_at_idx" ON "user_notifications"("user_id", "read_at");

-- AddForeignKey
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
