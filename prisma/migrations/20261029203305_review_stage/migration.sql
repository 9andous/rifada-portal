-- CreateEnum
CREATE TYPE "ReviewStage" AS ENUM ('SUPERVISOR', 'MANAGER');

-- AlterTable
ALTER TABLE "requests" ADD COLUMN     "reviewStage" "ReviewStage" NOT NULL DEFAULT 'SUPERVISOR';

-- CreateTable
CREATE TABLE "request_evaluations" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "criteria" JSONB NOT NULL,
    "note" TEXT,
    "signature" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_scope_changes" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_scope_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "request_evaluations_requestId_idx" ON "request_evaluations"("requestId");

-- CreateIndex
CREATE INDEX "request_scope_changes_requestId_idx" ON "request_scope_changes"("requestId");

-- AddForeignKey
ALTER TABLE "request_evaluations" ADD CONSTRAINT "request_evaluations_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_evaluations" ADD CONSTRAINT "request_evaluations_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_scope_changes" ADD CONSTRAINT "request_scope_changes_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_scope_changes" ADD CONSTRAINT "request_scope_changes_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
