ALTER TABLE "ClassPhoto" ALTER COLUMN "studentId" DROP NOT NULL;

ALTER TABLE "ClassPhoto"
ADD COLUMN "classSessionId" TEXT,
ADD COLUMN "caption" TEXT,
ADD COLUMN "isPublished" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "sentToParentAt" TIMESTAMP(3),
ADD COLUMN "createdById" TEXT,
ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "ClassPhoto" ADD CONSTRAINT "ClassPhoto_classSessionId_fkey" FOREIGN KEY ("classSessionId") REFERENCES "ClassSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClassPhoto" ADD CONSTRAINT "ClassPhoto_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "ClassPhoto" SET "isPublished" = true, "sentToParentAt" = "takenAt";

CREATE INDEX "ClassPhoto_classSessionId_takenAt_idx" ON "ClassPhoto"("classSessionId", "takenAt");
CREATE INDEX "ClassPhoto_studentId_takenAt_idx" ON "ClassPhoto"("studentId", "takenAt");
CREATE INDEX "ClassPhoto_isPublished_sentToParentAt_idx" ON "ClassPhoto"("isPublished", "sentToParentAt");
