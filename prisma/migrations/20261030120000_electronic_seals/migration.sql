-- D-122: electronic seals replace the drawn signatures. Existing evaluations and approvals are
-- sealed afterwards by `npm run seal:backfill`.

-- CreateEnum
CREATE TYPE "SealKind" AS ENUM ('EVALUATION', 'APPROVAL');

-- AlterTable
ALTER TABLE "request_approvals" DROP COLUMN "signature";

-- AlterTable
ALTER TABLE "request_evaluations" DROP COLUMN "signature";

-- CreateTable
CREATE TABLE "request_seals" (
    "id" TEXT NOT NULL,
    "serial" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "kind" "SealKind" NOT NULL,
    "signerId" TEXT NOT NULL,
    "evaluationId" TEXT,
    "approvalId" TEXT,
    "verifyCode" TEXT,
    "payload" TEXT NOT NULL,
    "digest" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "keyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_seals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seal_counters" (
    "hijriYear" INTEGER NOT NULL,
    "lastSeq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "seal_counters_pkey" PRIMARY KEY ("hijriYear")
);

-- CreateIndex
CREATE UNIQUE INDEX "request_seals_serial_key" ON "request_seals"("serial");

-- CreateIndex
CREATE UNIQUE INDEX "request_seals_evaluationId_key" ON "request_seals"("evaluationId");

-- CreateIndex
CREATE UNIQUE INDEX "request_seals_approvalId_key" ON "request_seals"("approvalId");

-- CreateIndex
CREATE UNIQUE INDEX "request_seals_verifyCode_key" ON "request_seals"("verifyCode");

-- CreateIndex
CREATE INDEX "request_seals_requestId_idx" ON "request_seals"("requestId");

-- AddForeignKey
ALTER TABLE "request_seals" ADD CONSTRAINT "request_seals_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_seals" ADD CONSTRAINT "request_seals_signerId_fkey" FOREIGN KEY ("signerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_seals" ADD CONSTRAINT "request_seals_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "request_evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_seals" ADD CONSTRAINT "request_seals_approvalId_fkey" FOREIGN KEY ("approvalId") REFERENCES "request_approvals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
