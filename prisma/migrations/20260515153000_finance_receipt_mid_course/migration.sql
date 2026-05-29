ALTER TABLE "Enrollment"
ADD COLUMN "joinSessionNumber" INTEGER,
ADD COLUMN "totalCourseSessionsAtJoin" INTEGER,
ADD COLUMN "freeTrialSessions" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "paidSessionsBeforeReceipt" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Receipt"
ADD COLUMN "grossAmount" DECIMAL(12, 2) NOT NULL DEFAULT 0,
ADD COLUMN "discountAmount" DECIMAL(12, 2) NOT NULL DEFAULT 0,
ADD COLUMN "discountPercent" DECIMAL(5, 2) NOT NULL DEFAULT 0,
ADD COLUMN "discountNote" TEXT,
ADD COLUMN "billableSessions" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "freeTrialSessions" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "paidSessionsBeforeReceipt" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "remainingSessionsAfterReceipt" INTEGER NOT NULL DEFAULT 0;

UPDATE "Receipt"
SET
  "grossAmount" = "amount",
  "billableSessions" = "sessions",
  "remainingSessionsAfterReceipt" = GREATEST(0, "Enrollment"."sessionsBought" - "Enrollment"."sessionsUsed")
FROM "Enrollment"
WHERE "Receipt"."enrollmentId" = "Enrollment"."id";
