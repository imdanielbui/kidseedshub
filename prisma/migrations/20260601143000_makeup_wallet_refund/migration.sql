-- CreateEnum
CREATE TYPE "MakeupEntitlementStatus" AS ENUM ('PENDING_SCHEDULE', 'SCHEDULED', 'COMPLETED', 'CREDITED', 'REFUNDED', 'EXPIRED', 'REJECTED');

-- CreateEnum
CREATE TYPE "StudentWalletEntryType" AS ENUM ('CREDIT', 'APPLIED');

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "refundEntitlementId" TEXT,
ADD COLUMN     "refundStudentId" TEXT;

-- AlterTable
ALTER TABLE "Receipt" ADD COLUMN     "walletCreditAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "MakeupEntitlement" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "attendanceId" TEXT,
    "absenceRequestId" TEXT,
    "classSessionId" TEXT,
    "month" TEXT NOT NULL,
    "status" "MakeupEntitlementStatus" NOT NULL DEFAULT 'PENDING_SCHEDULE',
    "isEligible" BOOLEAN NOT NULL DEFAULT true,
    "eligibilityReason" TEXT,
    "scheduledFor" TIMESTAMP(3),
    "resolvedAmount" DECIMAL(12,2),
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MakeupEntitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentWalletEntry" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "type" "StudentWalletEntryType" NOT NULL,
    "makeupEntitlementId" TEXT,
    "receiptId" TEXT,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentWalletEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MakeupEntitlement_attendanceId_key" ON "MakeupEntitlement"("attendanceId");

-- CreateIndex
CREATE UNIQUE INDEX "MakeupEntitlement_absenceRequestId_key" ON "MakeupEntitlement"("absenceRequestId");

-- CreateIndex
CREATE INDEX "MakeupEntitlement_studentId_month_status_idx" ON "MakeupEntitlement"("studentId", "month", "status");

-- CreateIndex
CREATE INDEX "MakeupEntitlement_enrollmentId_idx" ON "MakeupEntitlement"("enrollmentId");

-- CreateIndex
CREATE INDEX "MakeupEntitlement_classSessionId_idx" ON "MakeupEntitlement"("classSessionId");

-- CreateIndex
CREATE INDEX "MakeupEntitlement_resolvedById_idx" ON "MakeupEntitlement"("resolvedById");

-- CreateIndex
CREATE INDEX "StudentWalletEntry_studentId_createdAt_idx" ON "StudentWalletEntry"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "StudentWalletEntry_makeupEntitlementId_idx" ON "StudentWalletEntry"("makeupEntitlementId");

-- CreateIndex
CREATE INDEX "StudentWalletEntry_receiptId_idx" ON "StudentWalletEntry"("receiptId");

-- CreateIndex
CREATE INDEX "StudentWalletEntry_createdById_idx" ON "StudentWalletEntry"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_refundEntitlementId_key" ON "Expense"("refundEntitlementId");

-- CreateIndex
CREATE INDEX "Expense_refundStudentId_idx" ON "Expense"("refundStudentId");

-- AddForeignKey
ALTER TABLE "MakeupEntitlement" ADD CONSTRAINT "MakeupEntitlement_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MakeupEntitlement" ADD CONSTRAINT "MakeupEntitlement_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MakeupEntitlement" ADD CONSTRAINT "MakeupEntitlement_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "Attendance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MakeupEntitlement" ADD CONSTRAINT "MakeupEntitlement_absenceRequestId_fkey" FOREIGN KEY ("absenceRequestId") REFERENCES "AbsenceRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MakeupEntitlement" ADD CONSTRAINT "MakeupEntitlement_classSessionId_fkey" FOREIGN KEY ("classSessionId") REFERENCES "ClassSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MakeupEntitlement" ADD CONSTRAINT "MakeupEntitlement_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentWalletEntry" ADD CONSTRAINT "StudentWalletEntry_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentWalletEntry" ADD CONSTRAINT "StudentWalletEntry_makeupEntitlementId_fkey" FOREIGN KEY ("makeupEntitlementId") REFERENCES "MakeupEntitlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentWalletEntry" ADD CONSTRAINT "StudentWalletEntry_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentWalletEntry" ADD CONSTRAINT "StudentWalletEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_refundEntitlementId_fkey" FOREIGN KEY ("refundEntitlementId") REFERENCES "MakeupEntitlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_refundStudentId_fkey" FOREIGN KEY ("refundStudentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;
