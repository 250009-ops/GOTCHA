-- G1: Public Offer (oferta) version and acceptance time recorded per Plus purchase.
ALTER TABLE "import_payments" ADD COLUMN     "oferta_accepted_at" TIMESTAMP(3),
ADD COLUMN     "oferta_version" TEXT;
