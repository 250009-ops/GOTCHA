-- final-5 WL4-11 option B (Kai): hard-deleting a user keeps their sent messages; sender becomes NULL and is shown as "Deleted user". Non-destructive: no rows change.
-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_sender_id_fkey";

-- AlterTable
ALTER TABLE "messages" ALTER COLUMN "sender_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

