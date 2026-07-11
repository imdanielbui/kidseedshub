import { Prisma } from "@prisma/client"
import type { ReceiptListItem } from "@/lib/contracts/finance"

export const receiptListInclude = Prisma.validator<Prisma.ReceiptInclude>()({
  createdBy: true,
  enrollment: {
    include: {
      student: { include: { parent: { include: { user: true } } } },
      course: true
    }
  },
  lines: {
    include: {
      enrollment: {
        include: {
          student: { include: { parent: { include: { user: true } } } },
          course: true
        }
      }
    },
    orderBy: { createdAt: "asc" }
  },
  extraLines: {
    orderBy: { createdAt: "asc" }
  }
})

export type ReceiptListRecord = Prisma.ReceiptGetPayload<{ include: typeof receiptListInclude }>

export function toReceiptListItem(receipt: ReceiptListRecord): ReceiptListItem {
  const firstLine = receipt.lines[0]
  const student = firstLine?.enrollment.student ?? receipt.enrollment.student
  const parentUser = student.parent.user
  const courseName = receipt.lines.length > 1 ? `${receipt.lines.length} khóa đã đăng ký` : (firstLine?.courseName ?? receipt.enrollment.course.name)
  const coursePrice = firstLine?.coursePrice ?? receipt.enrollment.course.price
  const courseTotalSessions = firstLine?.courseTotalSessions ?? receipt.enrollment.course.totalSessions
  const billableSessions = receipt.lines.length ? receipt.lines.reduce((total, line) => total + line.billableSessions, 0) : receipt.billableSessions
  const freeTrialSessions = receipt.lines.length ? receipt.lines.reduce((total, line) => total + line.freeTrialSessions, 0) : receipt.freeTrialSessions
  const paidSessionsBeforeReceipt = receipt.lines.length ? receipt.lines.reduce((total, line) => total + line.paidSessionsBeforeReceipt, 0) : receipt.paidSessionsBeforeReceipt
  const remainingSessionsAfterReceipt = receipt.lines.length ? receipt.lines.reduce((total, line) => total + line.remainingSessionsAfterReceipt, 0) : receipt.remainingSessionsAfterReceipt

  return {
    id: receipt.id,
    code: receipt.code,
    enrollmentId: receipt.enrollmentId,
    studentCode: student.code,
    studentName: student.name,
    parentName: parentUser.name,
    parentPhone: parentUser.phone,
    courseName,
    coursePrice: coursePrice.toString(),
    courseTotalSessions,
    amount: receipt.amount.toString(),
    grossAmount: receipt.grossAmount.toString(),
    discountAmount: receipt.discountAmount.toString(),
    discountPercent: receipt.discountPercent.toString(),
    walletCreditAmount: receipt.walletCreditAmount.toString(),
    amountBeforeWalletCredit: receipt.amount.plus(receipt.walletCreditAmount).toString(),
    discountNote: receipt.note ?? undefined,
    sessions: receipt.sessions,
    billableSessions,
    freeTrialSessions,
    paidSessionsBeforeReceipt,
    remainingSessionsAfterReceipt,
    method: receipt.method,
    note: receipt.note ?? undefined,
    createdByName: receipt.createdBy.name,
    createdAt: receipt.createdAt.toISOString(),
    lines: receipt.lines.map((line) => ({
      id: line.id,
      enrollmentId: line.enrollmentId,
      courseName: line.courseName,
      coursePrice: line.coursePrice.toString(),
      courseTotalSessions: line.courseTotalSessions,
      unitPrice: line.unitPrice.toString(),
      grossAmount: line.grossAmount.toString(),
      discountAmount: line.discountAmount.toString(),
      discountPercent: line.discountPercent.toString(),
      amount: line.amount.toString(),
      billableSessions: line.billableSessions,
      freeTrialSessions: line.freeTrialSessions,
      paidSessionsBeforeReceipt: line.paidSessionsBeforeReceipt,
      remainingSessionsAfterReceipt: line.remainingSessionsAfterReceipt,
      billingPeriodStart: line.billingPeriodStart?.toISOString(),
      billingPeriodEnd: line.billingPeriodEnd?.toISOString(),
      billingLabel: line.billingLabel ?? undefined
    })),
    extraLines: receipt.extraLines.map((line) => ({
      id: line.id,
      type: line.type,
      description: line.description,
      quantity: line.quantity.toString(),
      unitPrice: line.unitPrice.toString(),
      amount: line.amount.toString(),
      note: line.note ?? undefined
    }))
  }
}
