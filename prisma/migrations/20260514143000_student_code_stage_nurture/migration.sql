-- AlterEnum
ALTER TYPE "StudentStatus" ADD VALUE IF NOT EXISTS 'NURTURE';

-- AlterTable
ALTER TABLE "Student" ADD COLUMN "code" TEXT;
ALTER TABLE "Student" ADD COLUMN "stageChangedAt" TIMESTAMP(3);

-- Backfill existing students with a yearly, human-readable code.
WITH ranked_students AS (
  SELECT
    "id",
    EXTRACT(YEAR FROM "createdAt")::INT AS "codeYear",
    ROW_NUMBER() OVER (
      PARTITION BY EXTRACT(YEAR FROM "createdAt")::INT
      ORDER BY "createdAt" ASC, "id" ASC
    ) AS "sequence"
  FROM "Student"
)
UPDATE "Student"
SET
  "code" = 'KSH-' || ranked_students."codeYear" || '-' || LPAD(ranked_students."sequence"::TEXT, 4, '0'),
  "stageChangedAt" = "Student"."updatedAt"
FROM ranked_students
WHERE "Student"."id" = ranked_students."id";

ALTER TABLE "Student" ALTER COLUMN "code" SET NOT NULL;
ALTER TABLE "Student" ALTER COLUMN "stageChangedAt" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Student_code_key" ON "Student"("code");
CREATE INDEX "Student_status_stageChangedAt_idx" ON "Student"("status", "stageChangedAt");
