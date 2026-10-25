-- AlterTable
ALTER TABLE "templates" ADD COLUMN     "currentFileId" TEXT,
ADD COLUMN     "sha256" TEXT;

-- CreateTable
CREATE TABLE "template_files" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "versionNo" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "template_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "template_files_storageKey_key" ON "template_files"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "template_files_templateId_versionNo_key" ON "template_files"("templateId", "versionNo");

-- CreateIndex
CREATE UNIQUE INDEX "templates_currentFileId_key" ON "templates"("currentFileId");

-- AddForeignKey
ALTER TABLE "templates" ADD CONSTRAINT "templates_currentFileId_fkey" FOREIGN KEY ("currentFileId") REFERENCES "template_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_files" ADD CONSTRAINT "template_files_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_files" ADD CONSTRAINT "template_files_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
