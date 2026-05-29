-- CreateEnum
CREATE TYPE "ScheduleEventType" AS ENUM ('HOLIDAY', 'EVENT');

-- CreateTable
CREATE TABLE "ScheduleEvent" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" "ScheduleEventType" NOT NULL DEFAULT 'HOLIDAY',
    "affectsScheduling" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleEvent_date_title_key" ON "ScheduleEvent"("date", "title");
