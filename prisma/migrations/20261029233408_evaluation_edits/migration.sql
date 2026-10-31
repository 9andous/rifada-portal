-- AlterTable
ALTER TABLE "request_evaluations" ADD COLUMN     "editedAt" TIMESTAMP(3),
ADD COLUMN     "editedById" TEXT;

-- AddForeignKey
ALTER TABLE "request_evaluations" ADD CONSTRAINT "request_evaluations_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
