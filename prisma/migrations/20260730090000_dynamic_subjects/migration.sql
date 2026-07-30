-- Preserve existing subject values while allowing administrators to add new subjects.
ALTER TABLE "Course" ALTER COLUMN "subject" TYPE TEXT USING "subject"::text;
ALTER TABLE "WeeklyAssessment" ALTER COLUMN "subject" TYPE TEXT USING "subject"::text;
ALTER TABLE "FinalAssessment" ALTER COLUMN "subject" TYPE TEXT USING "subject"::text;
ALTER TABLE "AssessmentRubricConfig" ALTER COLUMN "subject" TYPE TEXT USING "subject"::text;

DROP TYPE "CourseSubject";

CREATE TABLE "Subject" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Subject_key_key" ON "Subject"("key");
CREATE INDEX "Subject_isActive_sortOrder_idx" ON "Subject"("isActive", "sortOrder");

INSERT INTO "Subject" ("id", "key", "name", "isActive", "isSystem", "sortOrder", "updatedAt") VALUES
  ('subject_fun', 'FUN', 'FUN', true, true, 10, CURRENT_TIMESTAMP),
  ('subject_robotics', 'ROBOTICS', 'Robotics', true, true, 20, CURRENT_TIMESTAMP);
