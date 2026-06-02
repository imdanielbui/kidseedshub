-- CreateEnum
CREATE TYPE "StaffTimesheetSource" AS ENUM ('CLASS_SESSION', 'MANUAL', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "StaffTimesheetStatus" AS ENUM ('DRAFT', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "StaffTimesheetEntry" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "source" "StaffTimesheetSource" NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "hours" DECIMAL(5,2) NOT NULL,
    "status" "StaffTimesheetStatus" NOT NULL DEFAULT 'DRAFT',
    "linkedClassSessionId" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffTimesheetEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffTimesheetEntry_linkedClassSessionId_key" ON "StaffTimesheetEntry"("linkedClassSessionId");

-- CreateIndex
CREATE INDEX "StaffTimesheetEntry_staffId_date_idx" ON "StaffTimesheetEntry"("staffId", "date");

-- CreateIndex
CREATE INDEX "StaffTimesheetEntry_status_date_idx" ON "StaffTimesheetEntry"("status", "date");

-- CreateIndex
CREATE INDEX "StaffTimesheetEntry_approvedById_idx" ON "StaffTimesheetEntry"("approvedById");

-- AddForeignKey
ALTER TABLE "StaffTimesheetEntry" ADD CONSTRAINT "StaffTimesheetEntry_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffTimesheetEntry" ADD CONSTRAINT "StaffTimesheetEntry_linkedClassSessionId_fkey" FOREIGN KEY ("linkedClassSessionId") REFERENCES "ClassSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffTimesheetEntry" ADD CONSTRAINT "StaffTimesheetEntry_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
