-- PAY2-09: cross-process lookup burst guard (Postgres-backed sliding windows).
CREATE TABLE "lookup_burst_hits" (
    "id" BIGSERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "hit_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "lookup_burst_hits_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "lookup_burst_hits_user_id_hit_at_idx" ON "lookup_burst_hits"("user_id", "hit_at");
