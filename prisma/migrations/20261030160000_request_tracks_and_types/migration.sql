-- D-123: the association chooses the track and the request type; supervisors cover tracks.

-- CreateTable
CREATE TABLE "request_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "request_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "request_types_name_key" ON "request_types"("name");

-- The three request types of the design handoff.
INSERT INTO "request_types" ("id", "name", "sortOrder", "updatedAt") VALUES
  ('reqtype00000000000001', 'اعتماد مشروع/برنامج', 1, CURRENT_TIMESTAMP),
  ('reqtype00000000000002', 'تصريح إقامة نشاط', 2, CURRENT_TIMESTAMP),
  ('reqtype00000000000003', 'طلب محفزات وممكنات', 3, CURRENT_TIMESTAMP);

-- CreateTable
CREATE TABLE "supervisor_tracks" (
    "userId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supervisor_tracks_pkey" PRIMARY KEY ("userId","trackId")
);

-- CreateIndex
CREATE INDEX "supervisor_tracks_trackId_idx" ON "supervisor_tracks"("trackId");

-- AddForeignKey
ALTER TABLE "supervisor_tracks" ADD CONSTRAINT "supervisor_tracks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supervisor_tracks" ADD CONSTRAINT "supervisor_tracks_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A supervisor covers every track linked to one of their programmes.
INSERT INTO "supervisor_tracks" ("userId", "trackId")
SELECT DISTINCT sp."userId", tp."trackId"
FROM "supervisor_programs" sp
JOIN "track_programs" tp ON tp."programId" = sp."programId";

-- DropForeignKey
ALTER TABLE "supervisor_programs" DROP CONSTRAINT "supervisor_programs_programId_fkey";

-- DropForeignKey
ALTER TABLE "supervisor_programs" DROP CONSTRAINT "supervisor_programs_userId_fkey";

-- DropTable
DROP TABLE "supervisor_programs";

-- AlterTable
ALTER TABLE "requests" ADD COLUMN     "estimatedBudget" INTEGER,
ADD COLUMN     "expectedBeneficiaries" INTEGER,
ADD COLUMN     "kpis" TEXT,
ADD COLUMN     "partners" TEXT,
ADD COLUMN     "requestTypeId" TEXT,
ADD COLUMN     "trackId" TEXT,
ALTER COLUMN "programId" DROP NOT NULL,
ALTER COLUMN "initiativeId" DROP NOT NULL;

-- Existing requests: the first track (by number) linked to their programme, and «اعتماد مشروع/برنامج».
UPDATE "requests" r SET "trackId" = (
  SELECT t."id" FROM "track_programs" tp JOIN "tracks" t ON t."id" = tp."trackId"
  WHERE tp."programId" = r."programId" ORDER BY t."number" LIMIT 1
);
UPDATE "requests" SET "requestTypeId" = 'reqtype00000000000001';

-- CreateIndex
CREATE INDEX "requests_trackId_idx" ON "requests"("trackId");

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "tracks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_requestTypeId_fkey" FOREIGN KEY ("requestTypeId") REFERENCES "request_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
