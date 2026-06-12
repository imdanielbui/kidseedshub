import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { createAuditLog, getActiveStaffRecipientIds, notifyUsers } from "@/lib/backend/activity"
import { nextReceiptCode } from "@/lib/backend/codes"
import { parseMonth } from "@/lib/backend/date"
import { getStudentWalletBalance } from "@/lib/backend/makeup-entitlement"
import type { ReceiptListItem } from "@/lib/contracts/finance"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { receiptCreateSchema, receiptListQuerySchema } from "@/lib/validations/finance"

const receiptListInclude = Prisma.validator<Prisma.ReceiptInclude>()({
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

function toReceiptListItem(receipt: ReceiptListRecord): ReceiptListItem {
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

function combineDiscountInputs(inputs: Array<string | undefined>) {
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

export async function GET(request: Request) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "finance:view_summary") && !can(session.user.role, "finance:view_own")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền xem phiếu thu." }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const parsed = receiptListQuerySchema.safeParse(Object.fromEntries(searchParams))

  if (!parsed.success) {
    return fail({ code: "INVALID_QUERY", message: "Bộ lọc phiếu thu không hợp lệ." }, { status: 400 })
  }

  const range = parsed.data.month ? parseMonth(parsed.data.month) : null
  const receipts = await prisma.receipt.findMany({
    where: {
      ...(range ? { createdAt: { gte: range.start, lt: range.end } } : {}),
      ...(parsed.data.studentId
        ? {
            OR: [
              { enrollment: { studentId: parsed.data.studentId } },
              { lines: { some: { enrollment: { studentId: parsed.data.studentId } } } }
            ]
          }
        : {}),
      ...(session.user.role === "SALE" ? { createdById: session.user.id } : {})
    },
    include: receiptListInclude,
    orderBy: { createdAt: "desc" }
  })

  return ok(receipts.map(toReceiptListItem))
}

export async function POST(request: Request) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "receipts:create")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền tạo phiếu thu." }, { status: 403 })
  }

  const body = await request.json()
  const parsed = receiptCreateSchema.safeParse(body)

  if (!parsed.success) {
    return fail({ code: "INVALID_BODY", message: "Thông tin phiếu thu không hợp lệ." }, { status: 400 })
  }

  const data = parsed.data

  if (data.walletCreditAmount > 0 && !can(session.user.role, "wallet:apply_credit")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền áp dụng credit ví học viên." }, { status: 403 })
  }

  try {
    const receipt = await prisma.$transaction(async (tx) => {
      const inputExtraLines = data.extraLines ?? []
      const inputLines = data.lines?.length
        ? data.lines
        : [{
            enrollmentId: data.enrollmentId as string,
            amount: data.amount,
            billableSessions: data.billableSessions ?? data.sessions,
            freeTrialSessions: data.freeTrialSessions,
            paidSessionsBeforeReceipt: data.paidSessionsBeforeReceipt,
            discountInput: data.discountInput ?? (data.discountPercent ? `${data.discountPercent}%` : undefined),
            extraDiscountInput: data.extraDiscountInput ?? (data.discountAmount ? String(data.discountAmount) : undefined)
          }]

      const enrollmentIds = inputLines.map((line) => line.enrollmentId)
      const enrollments = await tx.enrollment.findMany({
        where: { id: { in: enrollmentIds } },
        include: { course: true, student: true }
      })

      if (enrollments.length !== enrollmentIds.length) {
        throw new Error("ENROLLMENT_NOT_FOUND")
      }

      const enrollmentById = new Map(enrollments.map((enrollment) => [enrollment.id, enrollment]))
      const studentIds = new Set(enrollments.map((enrollment) => enrollment.studentId))

      if (data.studentId && !studentIds.has(data.studentId)) {
        throw new Error("STUDENT_MISMATCH")
      }

      if (studentIds.size > 1) {
        throw new Error("MULTI_STUDENT_RECEIPT")
      }

      const computedLines = inputLines.map((line) => {
        const enrollment = enrollmentById.get(line.enrollmentId)
        if (!enrollment) throw new Error("ENROLLMENT_NOT_FOUND")

        const freeTrialSessions = line.freeTrialSessions ?? 0
        const joinSessionNumber = enrollment.joinSessionNumber ?? 1
        const sessionsFromJoin = Math.max(0, enrollment.course.totalSessions - joinSessionNumber + 1)
        const billableSessions = line.billableSessions ?? Math.max(0, sessionsFromJoin - freeTrialSessions)
        const unitPrice = enrollment.course.totalSessions > 0 ? enrollment.course.price.div(enrollment.course.totalSessions) : new Prisma.Decimal(0)
        const grossAmount = unitPrice.mul(billableSessions)
        const { discountAmount, discountPercent } = combineDiscountInputs([line.discountInput, line.extraDiscountInput])
        const percentDiscount = grossAmount.mul(discountPercent).div(100)
        const amountAfterDiscount = grossAmount.minus(discountAmount).minus(percentDiscount)
        const computedAmount = amountAfterDiscount.lessThan(0) ? new Prisma.Decimal(0) : amountAfterDiscount
        const amount = line.amount !== undefined ? new Prisma.Decimal(line.amount) : computedAmount
        const paidSessionsBeforeReceipt = line.paidSessionsBeforeReceipt ?? 0
        const nextSessionsBought = enrollment.sessionsBought + billableSessions
        const nextSessionsUsed = enrollment.sessionsUsed + paidSessionsBeforeReceipt

        return {
          enrollment,
          unitPrice,
          billableSessions,
          freeTrialSessions,
          paidSessionsBeforeReceipt,
          grossAmount,
          discountAmount,
          discountPercent,
          amount,
          remainingSessionsAfterReceipt: Math.max(0, nextSessionsBought - nextSessionsUsed)
        }
      })

      const computedExtraLines = inputExtraLines.map((line) => {
        const quantity = new Prisma.Decimal(line.quantity)
        const unitPrice = new Prisma.Decimal(line.unitPrice)
        const amount = quantity.mul(unitPrice)

        return {
          type: line.type,
          description: line.description,
          quantity,
          unitPrice,
          amount,
          note: line.note
        }
      })
      const totalExtraAmount = computedExtraLines.reduce((total, line) => total.plus(line.amount), new Prisma.Decimal(0))
      const totalGrossAmount = computedLines.reduce((total, line) => total.plus(line.grossAmount), totalExtraAmount)
      const totalDiscountAmount = computedLines.reduce((total, line) => total.plus(line.discountAmount.plus(line.grossAmount.mul(line.discountPercent).div(100))), new Prisma.Decimal(0))
      const computedCourseAmount = computedLines.reduce((total, line) => total.plus(line.amount), new Prisma.Decimal(0))
      const totalAmountBeforeWalletCredit = data.amount !== undefined ? new Prisma.Decimal(data.amount) : computedCourseAmount.plus(totalExtraAmount)
      const walletCreditAmount = new Prisma.Decimal(data.walletCreditAmount)
      const totalAmount = totalAmountBeforeWalletCredit.minus(walletCreditAmount)
      const totalSessions = computedLines.reduce((total, line) => total + line.billableSessions, 0)
      const totalFreeTrialSessions = computedLines.reduce((total, line) => total + line.freeTrialSessions, 0)
      const totalPaidBeforeReceipt = computedLines.reduce((total, line) => total + line.paidSessionsBeforeReceipt, 0)
      const totalRemainingAfterReceipt = computedLines.reduce((total, line) => total + line.remainingSessionsAfterReceipt, 0)
      const code = await nextReceiptCode(tx)
      const hasManualAmount = data.amount !== undefined || inputLines.some((line) => line.amount !== undefined) || totalExtraAmount.greaterThan(0)

      if (totalSessions === 0 && !hasManualAmount) {
        throw new Error("NO_PAYABLE_SESSIONS")
      }

      if (walletCreditAmount.greaterThan(0)) {
        const receiptStudentId = Array.from(studentIds)[0]
        const availableCredit = await getStudentWalletBalance(tx, receiptStudentId)

        if (walletCreditAmount.greaterThan(availableCredit)) {
          throw new Error("WALLET_CREDIT_EXCEEDS_BALANCE")
        }

        if (walletCreditAmount.greaterThan(totalAmountBeforeWalletCredit)) {
          throw new Error("WALLET_CREDIT_EXCEEDS_AMOUNT")
        }
      }

      const created = await tx.receipt.create({
        data: {
          code,
          enrollmentId: computedLines[0].enrollment.id,
          amount: totalAmount,
          grossAmount: totalGrossAmount,
          discountAmount: totalDiscountAmount,
          discountPercent: new Prisma.Decimal(0),
          walletCreditAmount,
          sessions: totalSessions,
          billableSessions: totalSessions,
          freeTrialSessions: totalFreeTrialSessions,
          paidSessionsBeforeReceipt: totalPaidBeforeReceipt,
          remainingSessionsAfterReceipt: totalRemainingAfterReceipt,
          method: data.method,
          note: data.note,
          createdById: session.user.id,
          lines: {
            create: computedLines.map((line) => ({
              enrollmentId: line.enrollment.id,
              courseName: line.enrollment.course.name,
              coursePrice: line.enrollment.course.price,
              courseTotalSessions: line.enrollment.course.totalSessions,
              unitPrice: line.unitPrice,
              billableSessions: line.billableSessions,
              freeTrialSessions: line.freeTrialSessions,
              paidSessionsBeforeReceipt: line.paidSessionsBeforeReceipt,
              grossAmount: line.grossAmount,
              discountAmount: line.discountAmount,
              discountPercent: line.discountPercent,
              amount: line.amount,
              remainingSessionsAfterReceipt: line.remainingSessionsAfterReceipt
            }))
          },
          extraLines: {
            create: computedExtraLines.map((line) => ({
              type: line.type,
              description: line.description,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              amount: line.amount,
              note: line.note
            }))
          }
        },
        include: receiptListInclude
      })

      if (walletCreditAmount.greaterThan(0)) {
        await tx.studentWalletEntry.create({
          data: {
            studentId: created.enrollment.studentId,
            amount: walletCreditAmount.mul(-1),
            type: "APPLIED",
            receiptId: created.id,
            note: `Áp dụng credit cho phiếu thu ${created.code}`,
            createdById: session.user.id
          }
        })
      }

      for (const line of computedLines) {
        const enrollment = await tx.enrollment.update({
          where: { id: line.enrollment.id },
          data: {
            sessionsBought: { increment: line.billableSessions },
            sessionsUsed: { increment: line.paidSessionsBeforeReceipt },
            freeTrialSessions: line.freeTrialSessions,
            paidSessionsBeforeReceipt: line.paidSessionsBeforeReceipt,
            isActive: true
          },
          include: { student: true }
        })

        if (enrollment.student.status === "TRIAL" || enrollment.student.status === "CONVERTED" || enrollment.student.status === "INACTIVE") {
          await tx.student.update({
            where: { id: enrollment.studentId },
            data: { status: "ACTIVE" }
          })
        }
      }

      await createAuditLog(tx, {
        actorId: session.user.id,
        action: "receipt.create",
        entityType: "Receipt",
        entityId: created.id,
        summary: `Tạo phiếu thu ${created.code} cho ${created.enrollment.student.name}`,
        metadata: {
          code: created.code,
          amount: created.amount.toString(),
          sessions: created.sessions,
          grossAmount: created.grossAmount.toString(),
          discountAmount: created.discountAmount.toString(),
          walletCreditAmount: created.walletCreditAmount.toString(),
          lineCount: created.lines.length,
          extraLineCount: created.extraLines.length,
          extraAmount: totalExtraAmount.toString(),
          enrollmentIds
        }
      })

      await notifyUsers(tx, {
        recipientIds: await getActiveStaffRecipientIds(tx, ["ADMIN"]),
        actorId: session.user.id,
        title: `Phiếu thu mới ${created.code}`,
        body: `${created.enrollment.student.name} - ${created.amount.toString()}đ`,
        href: "/finance",
        type: "FINANCE"
      })

      return created
    })

    return ok(toReceiptListItem(receipt), { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === "ENROLLMENT_NOT_FOUND") {
      return fail({ code: "ENROLLMENT_NOT_FOUND", message: "Không tìm thấy khóa đã đăng ký để tạo phiếu thu." }, { status: 404 })
    }

    if (error instanceof Error && error.message === "STUDENT_MISMATCH") {
      return fail({ code: "STUDENT_MISMATCH", message: "Khóa đã đăng ký không thuộc học viên này." }, { status: 400 })
    }

    if (error instanceof Error && error.message === "MULTI_STUDENT_RECEIPT") {
      return fail({ code: "MULTI_STUDENT_RECEIPT", message: "Một phiếu thu chỉ được tạo cho một học viên." }, { status: 400 })
    }

    if (error instanceof Error && error.message === "NO_PAYABLE_SESSIONS") {
      return fail({ code: "NO_PAYABLE_SESSIONS", message: "Không có buổi tính phí sau học thử. Hãy kiểm tra lại số buổi học thử hoặc nhập số tiền cần thu nếu đây là ngoại lệ." }, { status: 400 })
    }

    if (error instanceof Error && error.message === "WALLET_CREDIT_EXCEEDS_BALANCE") {
      return fail({ code: "WALLET_CREDIT_EXCEEDS_BALANCE", message: "Credit áp dụng vượt quá số dư ví học viên." }, { status: 400 })
    }

    if (error instanceof Error && error.message === "WALLET_CREDIT_EXCEEDS_AMOUNT") {
      return fail({ code: "WALLET_CREDIT_EXCEEDS_AMOUNT", message: "Credit áp dụng không được vượt quá số tiền phiếu thu." }, { status: 400 })
    }

    throw error
  }
}
