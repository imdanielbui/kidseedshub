ALTER TABLE "AssessmentItemResult" ADD COLUMN "score" INTEGER;

ALTER TABLE "AssessmentItemResult"
  ADD CONSTRAINT "AssessmentItemResult_score_range"
  CHECK ("score" IS NULL OR ("score" BETWEEN 1 AND 5));
