-- AlterTable
ALTER TABLE "program_goals" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "sourceNote" TEXT;

-- AlterTable
ALTER TABLE "programs" ADD COLUMN     "sourceNote" TEXT;

-- AlterTable
ALTER TABLE "strategic_objectives" ADD COLUMN     "sourceNote" TEXT;
