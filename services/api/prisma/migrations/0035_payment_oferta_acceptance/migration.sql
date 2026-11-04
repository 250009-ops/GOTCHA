-- G1: Public Offer (oferta) version and acceptance time recorded per Plus purchase.
ALTER TABLE "import_payments" ADD COLUMN IF NOT EXISTS "oferta_accepted_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "oferta_version" TEXT;
