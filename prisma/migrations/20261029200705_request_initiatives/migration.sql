-- CreateTable
CREATE TABLE "request_initiatives" (
    "requestId" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "request_initiatives_pkey" PRIMARY KEY ("requestId","initiativeId")
);

-- CreateIndex
CREATE INDEX "request_initiatives_initiativeId_idx" ON "request_initiatives"("initiativeId");

-- AddForeignKey
ALTER TABLE "request_initiatives" ADD CONSTRAINT "request_initiatives_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_initiatives" ADD CONSTRAINT "request_initiatives_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "initiatives"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Every existing request covers its one initiative (D-115).
INSERT INTO "request_initiatives" ("requestId", "initiativeId", "sortOrder")
SELECT "id", "initiativeId", 0 FROM "requests";
