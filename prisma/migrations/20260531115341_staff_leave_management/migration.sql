-- CreateEnum
CREATE TYPE "StaffLeaveType" AS ENUM ('PAID', 'UNPAID', 'SICK', 'OTHER');

-- CreateEnum
CREATE TYPE "StaffLeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELED');

-- DropIndex
DROP INDEX "ReceiptLine_enrollmentId_idx";

-- DropIndex
DROP INDEX "ReceiptLine_receiptId_idx";

-- DropIndex
DROP INDEX "Student_createdById_idx";

-- DropIndex
DROP INDEX "Student_saleOwnerId_idx";

-- DropIndex
DROP INDEX "Student_status_stageChangedAt_idx";

-- AlterTable
ALTER TABLE "ClassSession" ADD COLUMN     "substituteTeacherId" TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Student" ALTER COLUMN "stageChangedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "StaffLeaveRequest" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "type" "StaffLeaveType" NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "StaffLeaveStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffLeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffLeaveRequest_staffId_status_idx" ON "StaffLeaveRequest"("staffId", "status");

-- CreateIndex
CREATE INDEX "StaffLeaveRequest_startDate_endDate_idx" ON "StaffLeaveRequest"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "StaffLeaveRequest_reviewedById_idx" ON "StaffLeaveRequest"("reviewedById");

-- CreateIndex
CREATE INDEX "ClassSession_substituteTeacherId_idx" ON "ClassSession"("substituteTeacherId");

-- AddForeignKey
ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_substituteTeacherId_fkey" FOREIGN KEY ("substituteTeacherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffLeaveRequest" ADD CONSTRAINT "StaffLeaveRequest_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffLeaveRequest" ADD CONSTRAINT "StaffLeaveRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
