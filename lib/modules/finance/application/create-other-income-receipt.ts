import { Prisma } from "@prisma/client"
import { createAuditLog, getActiveStaffRecipientIds, notifyUsers } from "@/lib/backend/activity"
import { nextOtherIncomeReceiptCode } from "@/lib/backend/codes"
import type { otherIncomeReceiptCreateSchema } from "@/lib/validations/finance"
import { otherIncomeReceiptInclude, type OtherIncomeReceiptRecord } from "@/lib/modules/finance/other-income-receipt-item"
import type { z } from "zod"

type OtherIncomeReceiptCreateInput = z.infer<typeof otherIncomeReceiptCreateSchema>
type OtherIncomeReceiptTransaction = Prisma.TransactionClient

type OtherIncomeReceiptDeps = {
  nextCode?: typeof nextOtherIncomeReceiptCode
  createAudit?: (tx: OtherIncomeReceiptTransaction, input: Parameters<typeof createAuditLog>[1]) => Promise<unknown>
  notify?: (tx: OtherIncomeReceiptTransaction, input: Parameters<typeof notifyUsers>[1]) => Promise<unknown>
  getStaffRecipientIds?: typeof getActiveStaffRecipientIds
}

type OtherIncomeReceiptPrisma = {
  $transaction<T>(callback: (tx: OtherIncomeReceiptTransaction) => Promise<T>): Promise<T>
}

export async function createOtherIncomeReceipt({
  prisma,
  data,
  createdById,
  deps = {}
}: {
  prisma: OtherIncomeReceiptPrisma
  data: OtherIncomeReceiptCreateInput
  createdById: string
  deps?: OtherIncomeReceiptDeps
}): Promise<OtherIncomeReceiptRecord> {
  const nextCode = deps.nextCode ?? nextOtherIncomeReceiptCode
  const createAudit = deps.createAudit ?? createAuditLog
  const notify = deps.notify ?? notifyUsers
  const getStaffRecipientIds = deps.getStaffRecipientIds ?? getActiveStaffRecipientIds

  return prisma.$transaction(async (tx) => {
    const created = await tx.otherIncomeReceipt.create({
      data: {
        code: await nextCode(tx),
        category: data.category,
        amount: new Prisma.Decimal(data.amount),
        payerName: data.payerName,
        payerPhone: data.payerPhone || null,
        description: data.description,
        note: data.note || null,
        method: data.method,
        createdById
      },
      include: otherIncomeReceiptInclude
    })

    await createAudit(tx, {
      actorId: createdById,
      action: "other_income_receipt.create",
      entityType: "OtherIncomeReceipt",
      entityId: created.id,
      summary: `Tạo phiếu thu khác ${created.code} từ ${created.payerName}`,
      metadata: { code: created.code, category: created.category, amount: created.amount.toString() }
    })

    await notify(tx, {
      recipientIds: await getStaffRecipientIds(tx, ["ADMIN"]),
      actorId: createdById,
      title: `Phiếu thu khác mới ${created.code}`,
      body: `${created.payerName} - ${created.amount.toString()}đ`,
      href: "/finance",
      type: "FINANCE"
    })

    return created
  })
}
