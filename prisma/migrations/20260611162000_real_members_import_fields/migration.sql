-- Add fields needed to retain real member import data without deleting seed/demo records.
ALTER TABLE "Student" ADD COLUMN "address" TEXT;
ALTER TABLE "Class" ADD COLUMN "code" TEXT;

CREATE UNIQUE INDEX "Class_code_key" ON "Class"("code");
