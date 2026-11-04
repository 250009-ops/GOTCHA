-- Who switched AI off: 'user' (learner Settings) or 'admin' (support). Additive, nullable.
ALTER TABLE "users" ADD COLUMN "ai_disabled_by" TEXT;
