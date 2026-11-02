-- D-127: registration no longer asks for tracks and requests are not limited to an association's
-- tracks, so the table and column added in 20261102120000 are removed.
DROP TABLE "association_tracks";
ALTER TABLE "association_registrations" DROP COLUMN "trackNumbers";

-- When the assigned supervisor first opened the request (the «new request» banner).
ALTER TABLE "requests" ADD COLUMN "reviewerOpenedAt" TIMESTAMP(3);
-- Requests already under way count as opened, so the banner starts empty.
UPDATE "requests" SET "reviewerOpenedAt" = now() WHERE "assignedSupervisorId" IS NOT NULL;
