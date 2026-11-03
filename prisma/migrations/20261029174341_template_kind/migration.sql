-- CreateEnum
CREATE TYPE "TemplateKind" AS ENUM ('GUIDE', 'FORM');

-- AlterTable
ALTER TABLE "templates" ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "kind" "TemplateKind" NOT NULL DEFAULT 'FORM';
