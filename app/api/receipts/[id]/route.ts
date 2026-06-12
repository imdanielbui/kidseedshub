import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import type { ReceiptPrintDetail } from "@/lib/contracts/finance"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

type RouteContext = {
  params: Promise<{ id: string }>
}

const receiptDetailInclude = Prisma.validator<Prisma.ReceiptInclude>()({
  createdBy: true,
  enrollment: {
    include: {
      course: true,
      student: { include: { parent: { include: { user: true } } } }
    }
  },
  lines: {
    include: {
      enrollment: {
        include: {
          course: true,
          student: { include: { parent: { include: { user: true } } } }
        }
      }
    },
    orderBy: { createdAt: "asc" }
  },
  extraLines: {
    orderBy: { createdAt: "asc" }
  }
})

type ReceiptDetailRecord = Prisma.ReceiptGetPayload<{ include: typeof receiptDetailInclude }>

function formatMoney(value: Prisma.Decimal) {
  return value.toString()
}

function toVietnameseMoneyText(value: Prisma.Decimal) {
  const amount = Number(value.toFixed(0))
  if (!Number.isFinite(amount) || amount <= 0) return "Không đồng"

  return `${new Intl.NumberFormat("vi-VN").format(amount)} đồng`
}

function toReceiptDetail(receipt: ReceiptDetailRecord): ReceiptPrintDetail {
  const firstLine = receipt.lines[0]
  const course = receipt.enrollment.course
  const student = firstLine?.enrollment.student ?? receipt.enrollment.student
  const parentUser = student.parent.user
  const unitPrice = firstLine?.unitPrice ?? (course.totalSessions > 0 ? course.price.div(course.totalSessions) : new Prisma.Decimal(0))
  const courseName = receipt.lines.length > 1 ? `${receipt.lines.length} khóa đã đăng ký` : (firstLine?.courseName ?? course.name)
  const discountPercent = receipt.lines.length === 1 ? receipt.lines[0].discountPercent : receipt.discountPercent

  return {
    id: receipt.id,
    code: receipt.code,
    enrollmentId: receipt.enrollmentId,
    studentCode: student.code,
    studentName: student.name,
    parentName: parentUser.name,
    parentPhone: parentUser.phone,
    courseName,
    coursePrice: (firstLine?.coursePrice ?? course.price).toString(),
    courseTotalSessions: firstLine?.courseTotalSessions ?? course.totalSessions,
    amount: receipt.amount.toString(),
    grossAmount: formatMoney(receipt.grossAmount),
    discountAmount: formatMoney(receipt.discountAmount),
    discountPercent: discountPercent.toString(),
    walletCreditAmount: receipt.walletCreditAmount.toString(),
    amountBeforeWalletCredit: receipt.amount.plus(receipt.walletCreditAmount).toString(),
    discountNote: receipt.note ?? undefined,
    sessions: receipt.sessions,
    billableSessions: receipt.lines.length ? receipt.lines.reduce((total, line) => total + line.billableSessions, 0) : receipt.billableSessions,
    freeTrialSessions: receipt.lines.length ? receipt.lines.reduce((total, line) => total + line.freeTrialSessions, 0) : receipt.freeTrialSessions,
    paidSessionsBeforeReceipt: receipt.lines.length ? receipt.lines.reduce((total, line) => total + line.paidSessionsBeforeReceipt, 0) : receipt.paidSessionsBeforeReceipt,
    remainingSessionsAfterReceipt: receipt.lines.length ? receipt.lines.reduce((total, line) => total + line.remainingSessionsAfterReceipt, 0) : receipt.remainingSessionsAfterReceipt,
    method: receipt.method,
    note: receipt.note ?? undefined,
    createdByName: receipt.createdBy.name,
    createdAt: receipt.createdAt.toISOString(),
    centerName: "Kid Seeds Hub",
    branchName: "Trung tâm Hạt Giống Nhỏ",
    content: receipt.note || `Học phí ${courseName} cho bé ${student.name}`,
    amountInWords: toVietnameseMoneyText(receipt.amount),
    unitPrice: unitPrice.toString(),
    joinSessionNumber: firstLine?.enrollment.joinSessionNumber ?? receipt.enrollment.joinSessionNumber ?? undefined,
    totalCourseSessionsAtJoin: firstLine?.enrollment.totalCourseSessionsAtJoin ?? receipt.enrollment.totalCourseSessionsAtJoin ?? undefined,
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
      remainingSessionsAfterReceipt: line.remainingSessionsAfterReceipt
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

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "finance:view_summary") && !can(session.user.role, "finance:view_own") && !can(session.user.role, "receipts:create")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền xem phiếu thu." }, { status: 403 })
  }

  const { id } = await context.params
  const receipt = await prisma.receipt.findUnique({
    where: { id },
    include: receiptDetailInclude
  })

  if (!receipt) {
    return fail({ code: "NOT_FOUND", message: "Phiếu thu không tồn tại." }, { status: 404 })
  }

  if (session.user.role === "SALE" && receipt.createdById !== session.user.id) {
    return fail({ code: "FORBIDDEN", message: "Bạn chỉ được xem phiếu thu của mình." }, { status: 403 })
  }

  return ok(toReceiptDetail(receipt))
}
