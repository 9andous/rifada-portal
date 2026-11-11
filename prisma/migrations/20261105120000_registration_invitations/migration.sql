-- Association registration by invitation (D-149).
ALTER TYPE "RegistrationStatus" ADD VALUE 'INVITED' BEFORE 'PENDING';

ALTER TABLE "association_registrations"
  ALTER COLUMN "classification" DROP NOT NULL,
  ALTER COLUMN "region" DROP NOT NULL,
  ALTER COLUMN "city" DROP NOT NULL,
  ALTER COLUMN "contactPhone" DROP NOT NULL,
  ALTER COLUMN "officerUsername" DROP NOT NULL,
  ALTER COLUMN "officerPhone" DROP NOT NULL,
  ALTER COLUMN "pledgeAcceptedAt" DROP NOT NULL,
  ADD COLUMN "secondOfficerName" TEXT,
  ADD COLUMN "secondOfficerPhone" TEXT,
  ADD COLUMN "serviceSite" TEXT,
  ADD COLUMN "servicePlaces" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "letterKey" TEXT,
  ADD COLUMN "letterFileName" TEXT,
  ADD COLUMN "letterSize" INTEGER,
  ADD COLUMN "inviteToken" TEXT,
  ADD COLUMN "inviteExpiresAt" TIMESTAMP(3),
  ADD COLUMN "invitedById" TEXT,
  ADD COLUMN "submittedAt" TIMESTAMP(3);

-- Applications made before invitations were submitted when they were created.
UPDATE "association_registrations" SET "submittedAt" = "createdAt" WHERE "status" <> 'INVITED';

CREATE UNIQUE INDEX "association_registrations_inviteToken_key" ON "association_registrations"("inviteToken");
CREATE INDEX "association_registrations_contactEmail_idx" ON "association_registrations"("contactEmail");

ALTER TABLE "association_registrations"
  ADD CONSTRAINT "association_registrations_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
