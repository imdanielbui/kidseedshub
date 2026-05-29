CREATE TYPE "AbsenceRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "AbsenceRequest" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "parentId" TEXT NOT NULL,
  "classSessionId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" "AbsenceRequestStatus" NOT NULL DEFAULT 'PENDING',
  "adminNote" TEXT,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AbsenceRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AbsenceRequest_studentId_classSessionId_key" ON "AbsenceRequest"("studentId", "classSessionId");

ALTER TABLE "AbsenceRequest" ADD CONSTRAINT "AbsenceRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AbsenceRequest" ADD CONSTRAINT "AbsenceRequest_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AbsenceRequest" ADD CONSTRAINT "AbsenceRequest_classSessionId_fkey" FOREIGN KEY ("classSessionId") REFERENCES "ClassSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AbsenceRequest" ADD CONSTRAINT "AbsenceRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
