-- CreateEnum
CREATE TYPE "EnrollmentHoldStatus" AS ENUM ('ACTIVE', 'RESUMED', 'EXPIRED');

-- CreateTable
CREATE TABLE "EnrollmentHold" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "sourceClassId" TEXT,
    "resumedClassId" TEXT,
    "remainingSessions" INTEGER NOT NULL,
    "creditAmount" DECIMAL(12,2) NOT NULL,
    "holdMonths" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "EnrollmentHoldStatus" NOT NULL DEFAULT 'ACTIVE',
    "reason" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "resumedById" TEXT,
    "resumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EnrollmentHold_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EnrollmentHold_studentId_status_idx" ON "EnrollmentHold"("studentId", "status");
CREATE INDEX "EnrollmentHold_enrollmentId_status_idx" ON "EnrollmentHold"("enrollmentId", "status");
CREATE INDEX "EnrollmentHold_expiresAt_idx" ON "EnrollmentHold"("expiresAt");

ALTER TABLE "EnrollmentHold" ADD CONSTRAINT "EnrollmentHold_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EnrollmentHold" ADD CONSTRAINT "EnrollmentHold_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EnrollmentHold" ADD CONSTRAINT "EnrollmentHold_sourceClassId_fkey" FOREIGN KEY ("sourceClassId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EnrollmentHold" ADD CONSTRAINT "EnrollmentHold_resumedClassId_fkey" FOREIGN KEY ("resumedClassId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EnrollmentHold" ADD CONSTRAINT "EnrollmentHold_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EnrollmentHold" ADD CONSTRAINT "EnrollmentHold_resumedById_fkey" FOREIGN KEY ("resumedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
