-- Tracks replace programmes at registration, and an association's new requests are limited to its tracks.
ALTER TABLE "association_registrations" ALTER COLUMN "programNumbers" SET DEFAULT ARRAY[]::INTEGER[];
ALTER TABLE "association_registrations" ADD COLUMN "trackNumbers" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

CREATE TABLE "association_tracks" (
    "associationId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "association_tracks_pkey" PRIMARY KEY ("associationId","trackId")
);

CREATE INDEX "association_tracks_trackId_idx" ON "association_tracks"("trackId");

ALTER TABLE "association_tracks" ADD CONSTRAINT "association_tracks_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "association_tracks" ADD CONSTRAINT "association_tracks_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: an application's tracks are the tracks of the programmes it chose.
UPDATE "association_registrations" r
SET "trackNumbers" = COALESCE((
    SELECT array_agg(DISTINCT t."number" ORDER BY t."number")
    FROM "programs" p
    JOIN "track_programs" tp ON tp."programId" = p."id"
    JOIN "tracks" t ON t."id" = tp."trackId"
    WHERE p."number" = ANY(r."programNumbers")
), ARRAY[]::INTEGER[]);

-- Approved applications pass their tracks to the association.
INSERT INTO "association_tracks" ("associationId", "trackId")
SELECT DISTINCT r."associationId", t."id"
FROM "association_registrations" r
JOIN "tracks" t ON t."number" = ANY(r."trackNumbers")
WHERE r."associationId" IS NOT NULL
ON CONFLICT DO NOTHING;
