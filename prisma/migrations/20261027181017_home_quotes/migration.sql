-- CreateTable
CREATE TABLE "home_quotes" (
    "id" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "honorific" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "imageKey" TEXT,
    "imagePath" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "home_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "home_quotes_isActive_sortOrder_idx" ON "home_quotes"("isActive", "sortOrder");
