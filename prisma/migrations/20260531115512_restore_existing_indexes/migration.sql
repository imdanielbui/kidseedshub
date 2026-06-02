-- CreateIndex
CREATE INDEX "ReceiptLine_receiptId_idx" ON "ReceiptLine"("receiptId");

-- CreateIndex
CREATE INDEX "ReceiptLine_enrollmentId_idx" ON "ReceiptLine"("enrollmentId");

-- CreateIndex
CREATE INDEX "Student_saleOwnerId_idx" ON "Student"("saleOwnerId");

-- CreateIndex
CREATE INDEX "Student_createdById_idx" ON "Student"("createdById");

-- CreateIndex
CREATE INDEX "Student_status_stageChangedAt_idx" ON "Student"("status", "stageChangedAt");
