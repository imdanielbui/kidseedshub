CREATE TYPE "RubricConfigStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "FinalAssessmentStatus" AS ENUM ('DRAFT', 'READY', 'PUBLISHED');

CREATE TABLE "AssessmentRubricConfig" (
    "id" TEXT NOT NULL,
    "subject" "CourseSubject" NOT NULL,
    "version" TEXT NOT NULL,
    "status" "RubricConfigStatus" NOT NULL DEFAULT 'DRAFT',
    "domainsJson" JSONB NOT NULL,
    "createdById" TEXT,
    "activatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentRubricConfig_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "WeeklyAssessment"
ADD COLUMN "rubricConfigId" TEXT,
ADD COLUMN "rubricSnapshot" JSONB;

ALTER TABLE "FinalAssessment"
ADD COLUMN "status" "FinalAssessmentStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN "publishedAt" TIMESTAMP(3),
ADD COLUMN "publishedById" TEXT;

CREATE UNIQUE INDEX "AssessmentRubricConfig_subject_version_key" ON "AssessmentRubricConfig"("subject", "version");
CREATE INDEX "AssessmentRubricConfig_subject_status_idx" ON "AssessmentRubricConfig"("subject", "status");
CREATE INDEX "AssessmentRubricConfig_createdById_idx" ON "AssessmentRubricConfig"("createdById");
CREATE INDEX "WeeklyAssessment_rubricConfigId_idx" ON "WeeklyAssessment"("rubricConfigId");
CREATE INDEX "FinalAssessment_status_publishedAt_idx" ON "FinalAssessment"("status", "publishedAt");
CREATE INDEX "FinalAssessment_publishedById_idx" ON "FinalAssessment"("publishedById");

ALTER TABLE "AssessmentRubricConfig" ADD CONSTRAINT "AssessmentRubricConfig_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WeeklyAssessment" ADD CONSTRAINT "WeeklyAssessment_rubricConfigId_fkey" FOREIGN KEY ("rubricConfigId") REFERENCES "AssessmentRubricConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinalAssessment" ADD CONSTRAINT "FinalAssessment_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
