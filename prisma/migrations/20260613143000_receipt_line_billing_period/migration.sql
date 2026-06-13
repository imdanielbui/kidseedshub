-- AlterTable
ALTER TABLE "ReceiptLine" ADD COLUMN "billingPeriodStart" TIMESTAMP(3),
ADD COLUMN "billingPeriodEnd" TIMESTAMP(3),
ADD COLUMN "billingLabel" TEXT;

-- CreateIndex
CREATE INDEX "ReceiptLine_billingPeriodStart_idx" ON "ReceiptLine"("billingPeriodStart");
