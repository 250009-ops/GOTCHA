-- web-launch-04 final-5 (Kai): never cascade-delete content_purchases when a catalog item is deleted.
-- Non-destructive: only the FK action changes (CASCADE -> RESTRICT). No rows are read, changed or deleted.
-- Admin "delete" of a purchased catalog item now archives it instead (admin.service deleteContent).
ALTER TABLE "content_purchases" DROP CONSTRAINT IF EXISTS "content_purchases_content_id_fkey";
ALTER TABLE "content_purchases" ADD CONSTRAINT "content_purchases_content_id_fkey"
  FOREIGN KEY ("content_id") REFERENCES "content_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
