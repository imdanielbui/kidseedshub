import assert from "node:assert/strict"
import test from "node:test"
import { createOtherIncomeReceipt } from "../lib/modules/finance/application/create-other-income-receipt"
import type { OtherIncomeReceiptRecord } from "../lib/modules/finance/other-income-receipt-item"

test("createOtherIncomeReceipt records non-tuition income without an enrollment mutation", async () => {
  let createdData: Record<string, unknown> | undefined
  let auditAction = ""
  let notificationHref = ""
  const receipt = {
    id: "other-income-1",
    code: "PTK-2026-001",
    category: "WORKSHOP_EVENT",
    amount: { toString: () => "500000" },
    payerName: "Nguyen Van A",
    payerPhone: "0900000000",
    description: "Phi workshop robot",
    note: null,
    method: "BANK_TRANSFER",
    createdById: "admin-1",
    createdAt: new Date("2026-07-30T00:00:00.000Z"),
    createdBy: { id: "admin-1", name: "Admin" }
  } as unknown as OtherIncomeReceiptRecord

  const result = await createOtherIncomeReceipt({
    prisma: {
      $transaction: async (callback) => callback({
        otherIncomeReceipt: {
          create: async ({ data }: { data: Record<string, unknown> }) => {
            createdData = data
            return receipt
          }
        }
      } as never)
    },
    data: {
      category: "WORKSHOP_EVENT",
      amount: 500000,
      payerName: "Nguyen Van A",
      payerPhone: "0900000000",
      description: "Phi workshop robot",
      method: "BANK_TRANSFER"
    },
    createdById: "admin-1",
    deps: {
      nextCode: async () => "PTK-2026-001",
      createAudit: async (_, input) => { auditAction = input.action },
      getStaffRecipientIds: async () => ["admin-1"],
      notify: async (_, input) => { notificationHref = input.href ?? "" }
    }
  })

  assert.equal(result.code, "PTK-2026-001")
  assert.equal(createdData?.code, "PTK-2026-001")
  assert.equal(createdData?.createdById, "admin-1")
  assert.equal("enrollmentId" in (createdData ?? {}), false)
  assert.equal(auditAction, "other_income_receipt.create")
  assert.equal(notificationHref, "/finance")
})
