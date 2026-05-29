CREATE TABLE "ReceiptLine" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "courseName" TEXT NOT NULL,
    "coursePrice" DECIMAL(12,2) NOT NULL,
    "courseTotalSessions" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "billableSessions" INTEGER NOT NULL,
    "freeTrialSessions" INTEGER NOT NULL DEFAULT 0,
    "paidSessionsBeforeReceipt" INTEGER NOT NULL DEFAULT 0,
    "grossAmount" DECIMAL(12,2) NOT NULL,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "amount" DECIMAL(12,2) NOT NULL,
    "remainingSessionsAfterReceipt" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReceiptLine_pkey" PRIMARY KEY ("id")
);

INSERT INTO "ReceiptLine" (
    "id",
    "receiptId",
    "enrollmentId",
    "courseName",
    "coursePrice",
    "courseTotalSessions",
    "unitPrice",
    "billableSessions",
    "freeTrialSessions",
    "paidSessionsBeforeReceipt",
    "grossAmount",
    "discountAmount",
    "discountPercent",
    "amount",
    "remainingSessionsAfterReceipt",
    "createdAt"
)
SELECT
    'rl_' || r."id",
    r."id",
    r."enrollmentId",
    c."name",
    c."price",
    c."totalSessions",
    CASE WHEN c."totalSessions" > 0 THEN c."price" / c."totalSessions" ELSE 0 END,
    COALESCE(NULLIF(r."billableSessions", 0), r."sessions"),
    r."freeTrialSessions",
    r."paidSessionsBeforeReceipt",
    COALESCE(NULLIF(r."grossAmount", 0), r."amount"),
    r."discountAmount",
    r."discountPercent",
    r."amount",
    r."remainingSessionsAfterReceipt",
    r."createdAt"
FROM "Receipt" r
JOIN "Enrollment" e ON e."id" = r."enrollmentId"
JOIN "Course" c ON c."id" = e."courseId"
WHERE NOT EXISTS (
    SELECT 1 FROM "ReceiptLine" rl WHERE rl."receiptId" = r."id"
);

ALTER TABLE "ReceiptLine" ADD CONSTRAINT "ReceiptLine_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReceiptLine" ADD CONSTRAINT "ReceiptLine_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "ReceiptLine_receiptId_idx" ON "ReceiptLine"("receiptId");
CREATE INDEX "ReceiptLine_enrollmentId_idx" ON "ReceiptLine"("enrollmentId");
