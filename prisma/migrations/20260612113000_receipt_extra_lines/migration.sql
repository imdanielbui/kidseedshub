-- CreateEnum
CREATE TYPE "ReceiptExtraLineType" AS ENUM ('TUTORING', 'OTHER');

-- CreateTable
CREATE TABLE "ReceiptExtraLine" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "type" "ReceiptExtraLineType" NOT NULL DEFAULT 'TUTORING',
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(8,2) NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReceiptExtraLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReceiptExtraLine_receiptId_idx" ON "ReceiptExtraLine"("receiptId");

-- CreateIndex
CREATE INDEX "ReceiptExtraLine_type_idx" ON "ReceiptExtraLine"("type");

-- AddForeignKey
ALTER TABLE "ReceiptExtraLine" ADD CONSTRAINT "ReceiptExtraLine_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
