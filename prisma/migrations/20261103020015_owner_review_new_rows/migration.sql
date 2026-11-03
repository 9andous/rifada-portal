-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "requestId" TEXT;

-- AlterTable
ALTER TABLE "requests" ADD COLUMN     "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "resubmittedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "request_seen" (
    "userId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_seen_pkey" PRIMARY KEY ("userId","requestId")
);

-- CreateIndex
CREATE INDEX "request_seen_requestId_idx" ON "request_seen"("requestId");

-- CreateIndex
CREATE INDEX "notifications_userId_requestId_idx" ON "notifications"("userId", "requestId");

-- AddForeignKey
ALTER TABLE "request_seen" ADD CONSTRAINT "request_seen_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_seen" ADD CONSTRAINT "request_seen_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill (D-130).
-- The last activity of an existing request is its last change.
UPDATE "requests" SET "lastActivityAt" = "updatedAt";

-- A request sent back after being returned: its latest RETURNED -> SUBMITTED move.
UPDATE "requests" r SET "resubmittedAt" = h.at
FROM (
  SELECT sh."requestId", MAX(sh."createdAt") AS at
  FROM "request_status_history" sh
  JOIN "request_statuses" f ON f."id" = sh."fromStatusId" AND f."key" = 'RETURNED'
  JOIN "request_statuses" t ON t."id" = sh."toStatusId" AND t."key" = 'SUBMITTED'
  GROUP BY sh."requestId"
) h
WHERE h."requestId" = r."id";

-- Notifications name their request through the link's last segment.
UPDATE "notifications" n SET "requestId" = r."id"
FROM "requests" r
WHERE n."link" IS NOT NULL AND n."link" LIKE '%/' || r."id";

-- What exists today counts as seen, so «جديد» starts with the next action instead of marking
-- every old row: staff for submitted requests, officers for their association's requests.
INSERT INTO "request_seen" ("userId", "requestId", "seenAt")
SELECT u."id", r."id", CURRENT_TIMESTAMP
FROM "users" u
JOIN "requests" r
  ON (u."role" IN ('SUPERVISOR', 'UNIT_MANAGER', 'SUPER_ADMIN') AND r."referenceNo" IS NOT NULL)
  OR (u."role" = 'ASSOCIATION_OFFICER' AND u."associationId" = r."associationId")
ON CONFLICT DO NOTHING;
