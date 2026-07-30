import { Prisma } from "@prisma/client"
import type { OtherIncomeReceiptItem } from "@/lib/contracts/finance"

export const otherIncomeReceiptInclude = Prisma.validator<Prisma.OtherIncomeReceiptInclude>()({
  createdBy: true
})

export type OtherIncomeReceiptRecord = Prisma.OtherIncomeReceiptGetPayload<{ include: typeof otherIncomeReceiptInclude }>

export function toOtherIncomeReceiptItem(receipt: OtherIncomeReceiptRecord): OtherIncomeReceiptItem {
  return {
    id: receipt.id,
    code: receipt.code,
    category: receipt.category,
    amount: receipt.amount.toString(),
    payerName: receipt.payerName,
    payerPhone: receipt.payerPhone ?? undefined,
    description: receipt.description,
    note: receipt.note ?? undefined,
    method: receipt.method,
    createdByName: receipt.createdBy.name,
    createdAt: receipt.createdAt.toISOString()
  }
}
