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

type ReceiptListRecord = Prisma.ReceiptGetPayload<{ include: typeof receiptListInclude }>

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

function parseDiscountInput(input: string | undefined) {
  const raw = input?.trim() ?? ""
  if (!raw) {
    return {
      discountAmount: new Prisma.Decimal(0),
      discountPercent: new Prisma.Decimal(0)
    }
  }

  if (raw.includes("%")) {
    const percent = Number(raw.replace("%", "").replace(",", ".").replace(/[^\d.-]/g, "").trim())
    return {
      discountAmount: new Prisma.Decimal(0),
      discountPercent: new Prisma.Decimal(Number.isFinite(percent) ? Math.min(Math.max(percent, 0), 100) : 0)
    }
  }

  const amount = Number(raw.replace(/[^\d]/g, ""))
  if (Number.isFinite(amount) && amount <= 100) {
    return {
      discountAmount: new Prisma.Decimal(0),
      discountPercent: new Prisma.Decimal(Math.max(amount, 0))
    }
  }

  return {
    discountAmount: new Prisma.Decimal(Number.isFinite(amount) ? Math.max(amount, 0) : 0),
    discountPercent: new Prisma.Decimal(0)
  }
}

export function combineDiscountInputs(inputs: Array<string | undefined>) {
  return inputs.reduce(
    (total, input) => {
      const parsed = parseDiscountInput(input)
      const nextPercent = total.discountPercent.plus(parsed.discountPercent)
      return {
        discountAmount: total.discountAmount.plus(parsed.discountAmount),
        discountPercent: nextPercent.greaterThan(100) ? new Prisma.Decimal(100) : nextPercent
      }
    },
    {
      discountAmount: new Prisma.Decimal(0),
      discountPercent: new Prisma.Decimal(0)
    }
  )
}
