-- Separate non-tuition income from student tuition receipts so it never affects enrollments or session balances.
CREATE TYPE "OtherIncomeCategory" AS ENUM ('WORKSHOP_EVENT', 'MATERIALS', 'REGISTRATION_FEE', 'OTHER');

CREATE TABLE "OtherIncomeReceipt" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "category" "OtherIncomeCategory" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "payerName" TEXT NOT NULL,
    "payerPhone" TEXT,
    "description" TEXT NOT NULL,
    "note" TEXT,
    "method" "PaymentMethod" NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OtherIncomeReceipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OtherIncomeReceipt_code_key" ON "OtherIncomeReceipt"("code");
CREATE INDEX "OtherIncomeReceipt_createdAt_idx" ON "OtherIncomeReceipt"("createdAt");
CREATE INDEX "OtherIncomeReceipt_category_createdAt_idx" ON "OtherIncomeReceipt"("category", "createdAt");
CREATE INDEX "OtherIncomeReceipt_createdById_createdAt_idx" ON "OtherIncomeReceipt"("createdById", "createdAt");

ALTER TABLE "OtherIncomeReceipt" ADD CONSTRAINT "OtherIncomeReceipt_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
