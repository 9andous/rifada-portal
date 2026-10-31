-- CreateTable
CREATE TABLE "request_approvals" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "request_approvals_requestId_idx" ON "request_approvals"("requestId");

-- AddForeignKey
ALTER TABLE "request_approvals" ADD CONSTRAINT "request_approvals_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_approvals" ADD CONSTRAINT "request_approvals_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
