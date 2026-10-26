-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "association_registrations" (
    "id" TEXT NOT NULL,
    "referenceNo" TEXT NOT NULL,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "name" TEXT NOT NULL,
    "licenseNumber" TEXT NOT NULL,
    "classification" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "foundedYear" INTEGER,
    "contactPhone" TEXT NOT NULL,
    "contactEmail" TEXT,
    "website" TEXT,
    "programNumbers" INTEGER[],
    "officerName" TEXT NOT NULL,
    "officerUsername" TEXT NOT NULL,
    "officerEmail" TEXT,
    "officerPhone" TEXT NOT NULL,
    "officerNationalId" TEXT,
    "passwordHash" TEXT,
    "pledgeAcceptedAt" TIMESTAMP(3) NOT NULL,
    "decisionNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "associationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "association_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "association_registrations_referenceNo_key" ON "association_registrations"("referenceNo");

-- CreateIndex
CREATE UNIQUE INDEX "association_registrations_associationId_key" ON "association_registrations"("associationId");

-- CreateIndex
CREATE INDEX "association_registrations_status_createdAt_idx" ON "association_registrations"("status", "createdAt");

-- CreateIndex
CREATE INDEX "association_registrations_licenseNumber_idx" ON "association_registrations"("licenseNumber");

-- CreateIndex
CREATE INDEX "association_registrations_officerUsername_idx" ON "association_registrations"("officerUsername");

-- AddForeignKey
ALTER TABLE "association_registrations" ADD CONSTRAINT "association_registrations_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "association_registrations" ADD CONSTRAINT "association_registrations_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "associations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
