-- Telegram auth and phone login.

ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;

ALTER TABLE "users" ADD COLUMN "phone" TEXT;
ALTER TABLE "users" ADD COLUMN "phone_verified_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "telegram_id" BIGINT;
ALTER TABLE "users" ADD COLUMN "telegram_username" TEXT;
ALTER TABLE "users" ADD COLUMN "telegram_bot_blocked_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");
CREATE UNIQUE INDEX "users_telegram_id_key" ON "users"("telegram_id");

CREATE TYPE "TelegramChallengeKind" AS ENUM ('code', 'link');
CREATE TYPE "TelegramChallengeStatus" AS ENUM ('pending', 'approved', 'denied', 'expired', 'used');

CREATE TABLE "telegram_login_challenges" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "kind" "TelegramChallengeKind" NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'login',
    "code_hash" TEXT,
    "token" TEXT,
    "status" "TelegramChallengeStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "user_agent" TEXT,
    "ip" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "last_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "telegram_login_challenges_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "telegram_login_challenges_token_key" ON "telegram_login_challenges"("token");
CREATE INDEX "telegram_login_challenges_user_id_status_idx" ON "telegram_login_challenges"("user_id", "status");
CREATE INDEX "telegram_login_challenges_status_expires_at_idx" ON "telegram_login_challenges"("status", "expires_at");

ALTER TABLE "telegram_login_challenges"
  ADD CONSTRAINT "telegram_login_challenges_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "telegram_pending_signups" (
    "telegram_id" BIGINT NOT NULL,
    "phone" TEXT,
    "phone_shared_at" TIMESTAMP(3),
    "first_name" TEXT NOT NULL DEFAULT '',
    "last_name" TEXT NOT NULL DEFAULT '',
    "username" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "telegram_pending_signups_pkey" PRIMARY KEY ("telegram_id")
);

CREATE TABLE "telegram_outbound_log" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "telegram_outbound_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "telegram_outbound_log_user_id_created_at_idx" ON "telegram_outbound_log"("user_id", "created_at");
