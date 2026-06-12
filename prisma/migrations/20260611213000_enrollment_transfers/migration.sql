-- CreateTable
CREATE TABLE "EnrollmentTransfer" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "fromEnrollmentId" TEXT NOT NULL,
    "toEnrollmentId" TEXT,
    "fromClassId" TEXT,
    "toClassId" TEXT,
    "remainingSessions" INTEGER NOT NULL,
    "creditAmount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnrollmentTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EnrollmentTransfer_studentId_createdAt_idx" ON "EnrollmentTransfer"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "EnrollmentTransfer_fromEnrollmentId_idx" ON "EnrollmentTransfer"("fromEnrollmentId");

-- CreateIndex
CREATE INDEX "EnrollmentTransfer_toEnrollmentId_idx" ON "EnrollmentTransfer"("toEnrollmentId");

-- CreateIndex
CREATE INDEX "EnrollmentTransfer_fromClassId_idx" ON "EnrollmentTransfer"("fromClassId");

-- CreateIndex
CREATE INDEX "EnrollmentTransfer_toClassId_idx" ON "EnrollmentTransfer"("toClassId");

-- CreateIndex
CREATE INDEX "EnrollmentTransfer_createdById_idx" ON "EnrollmentTransfer"("createdById");

-- AddForeignKey
ALTER TABLE "EnrollmentTransfer" ADD CONSTRAINT "EnrollmentTransfer_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentTransfer" ADD CONSTRAINT "EnrollmentTransfer_fromEnrollmentId_fkey" FOREIGN KEY ("fromEnrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentTransfer" ADD CONSTRAINT "EnrollmentTransfer_toEnrollmentId_fkey" FOREIGN KEY ("toEnrollmentId") REFERENCES "Enrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentTransfer" ADD CONSTRAINT "EnrollmentTransfer_fromClassId_fkey" FOREIGN KEY ("fromClassId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentTransfer" ADD CONSTRAINT "EnrollmentTransfer_toClassId_fkey" FOREIGN KEY ("toClassId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentTransfer" ADD CONSTRAINT "EnrollmentTransfer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
