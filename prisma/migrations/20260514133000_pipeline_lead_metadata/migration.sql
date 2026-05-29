-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'UNKNOWN');

-- AlterTable
ALTER TABLE "Student" ADD COLUMN "gender" "Gender" NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE "Student" ADD COLUMN "saleOwnerId" TEXT;
ALTER TABLE "Student" ADD COLUMN "createdById" TEXT;

-- CreateIndex
CREATE INDEX "Student_saleOwnerId_idx" ON "Student"("saleOwnerId");
CREATE INDEX "Student_createdById_idx" ON "Student"("createdById");

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_saleOwnerId_fkey" FOREIGN KEY ("saleOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Student" ADD CONSTRAINT "Student_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
