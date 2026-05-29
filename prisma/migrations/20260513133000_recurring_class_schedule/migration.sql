-- CreateEnum
CREATE TYPE "ClassSessionStatus" AS ENUM ('SCHEDULED', 'CANCELED', 'COMPLETED');

-- AlterTable
ALTER TABLE "Class"
ADD COLUMN "startDate" TIMESTAMP(3),
ADD COLUMN "plannedSessions" INTEGER;

-- CreateTable
CREATE TABLE "ClassScheduleSlot" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "room" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassScheduleSlot_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "ClassSession"
ADD COLUMN "scheduleSlotId" TEXT,
ADD COLUMN "startTime" TEXT,
ADD COLUMN "endTime" TEXT,
ADD COLUMN "room" TEXT,
ADD COLUMN "status" "ClassSessionStatus" NOT NULL DEFAULT 'SCHEDULED',
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AddForeignKey
ALTER TABLE "ClassScheduleSlot" ADD CONSTRAINT "ClassScheduleSlot_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_scheduleSlotId_fkey" FOREIGN KEY ("scheduleSlotId") REFERENCES "ClassScheduleSlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
