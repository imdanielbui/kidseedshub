import { Prisma } from "@prisma/client"
import { createAuditLog, getActiveStaffRecipientIds, notifyUsers } from "@/lib/backend/activity"
import { nextReceiptCode } from "@/lib/backend/codes"
import { getStudentWalletBalance } from "@/lib/backend/makeup-entitlement"
import { countBillingPeriodSessions, parseBillingPeriod } from "@/lib/backend/receipt-billing"
import type { receiptCreateSchema } from "@/lib/validations/finance"
import { receiptListInclude, type ReceiptListRecord } from "@/lib/modules/finance/receipt-list-item"
import { combineDiscountInputs } from "./receipt-discounts"
import { ReceiptCreationError, receiptCreationErrorCodes } from "./receipt-errors"
import type { z } from "zod"

type ReceiptCreateInput = z.infer<typeof receiptCreateSchema>
type ReceiptTransactionClient = Prisma.TransactionClient

type ReceiptCreationDeps = {
  nextCode?: typeof nextReceiptCode
  getWalletBalance?: typeof getStudentWalletBalance
  countBillingSessions?: typeof countBillingPeriodSessions
  createAudit?: (tx: ReceiptTransactionClient, input: Parameters<typeof createAuditLog>[1]) => Promise<unknown>
  notify?: (tx: ReceiptTransactionClient, input: Parameters<typeof notifyUsers>[1]) => Promise<unknown>
  getStaffRecipientIds?: typeof getActiveStaffRecipientIds
}

type ReceiptPrisma = {
  $transaction<T>(callback: (tx: ReceiptTransactionClient) => Promise<T>): Promise<T>
}

export async function createReceipt({
  prisma,
  data,
  createdById,
  deps = {}
}: {
  prisma: ReceiptPrisma
  data: ReceiptCreateInput
  createdById: string
  deps?: ReceiptCreationDeps
}): Promise<ReceiptListRecord> {
  const nextCode = deps.nextCode ?? nextReceiptCode
  const getWalletBalance = deps.getWalletBalance ?? getStudentWalletBalance
  const countBillingSessions = deps.countBillingSessions ?? countBillingPeriodSessions
  const createAudit = deps.createAudit ?? createAuditLog
  const notify = deps.notify ?? notifyUsers
  const getStaffRecipientIds = deps.getStaffRecipientIds ?? getActiveStaffRecipientIds

  return prisma.$transaction(async (tx) => {
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
      throw new ReceiptCreationError(receiptCreationErrorCodes.enrollmentNotFound)
    }

    const enrollmentById = new Map(enrollments.map((enrollment) => [enrollment.id, enrollment]))
    const studentIds = new Set(enrollments.map((enrollment) => enrollment.studentId))

    if (data.studentId && !studentIds.has(data.studentId)) {
      throw new ReceiptCreationError(receiptCreationErrorCodes.studentMismatch)
    }

    if (studentIds.size > 1) {
      throw new ReceiptCreationError(receiptCreationErrorCodes.multiStudentReceipt)
    }

    const computedLines = await Promise.all(inputLines.map(async (line) => {
      const enrollment = enrollmentById.get(line.enrollmentId)
      if (!enrollment) throw new ReceiptCreationError(receiptCreationErrorCodes.enrollmentNotFound)

      const freeTrialSessions = line.freeTrialSessions ?? 0
      const billingPeriod = parseReceiptBillingPeriod({
        start: line.billingPeriodStart,
        end: line.billingPeriodEnd,
        label: line.billingLabel
      })
      const joinSessionNumber = enrollment.joinSessionNumber ?? 1
      const sessionsFromJoin = Math.max(0, enrollment.course.totalSessions - joinSessionNumber + 1)
      const billingPeriodSessions = await countBillingSessions(tx, enrollment, billingPeriod)
      const defaultBillableSessions = billingPeriodSessions ?? Math.max(0, sessionsFromJoin - freeTrialSessions)
      const billableSessions = line.billableSessions ?? Math.max(0, defaultBillableSessions - (billingPeriodSessions === undefined ? 0 : freeTrialSessions))
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
        remainingSessionsAfterReceipt: Math.max(0, nextSessionsBought - nextSessionsUsed),
        billingPeriod
      }
    }))

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
    const code = await nextCode(tx)
    const hasManualAmount = data.amount !== undefined || inputLines.some((line) => line.amount !== undefined) || totalExtraAmount.greaterThan(0)

    if (totalSessions === 0 && !hasManualAmount) {
      throw new ReceiptCreationError(receiptCreationErrorCodes.noPayableSessions)
    }

    if (walletCreditAmount.greaterThan(0)) {
      const receiptStudentId = Array.from(studentIds)[0]
      const availableCredit = await getWalletBalance(tx, receiptStudentId)

      if (walletCreditAmount.greaterThan(availableCredit)) {
        throw new ReceiptCreationError(receiptCreationErrorCodes.walletCreditExceedsBalance)
      }

      if (walletCreditAmount.greaterThan(totalAmountBeforeWalletCredit)) {
        throw new ReceiptCreationError(receiptCreationErrorCodes.walletCreditExceedsAmount)
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
        createdById,
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
            remainingSessionsAfterReceipt: line.remainingSessionsAfterReceipt,
            billingPeriodStart: line.billingPeriod.start,
            billingPeriodEnd: line.billingPeriod.end,
            billingLabel: line.billingPeriod.label
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
          createdById
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

    await createAudit(tx, {
      actorId: createdById,
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

    await notify(tx, {
      recipientIds: await getStaffRecipientIds(tx, ["ADMIN"]),
      actorId: createdById,
      title: `Phiếu thu mới ${created.code}`,
      body: `${created.enrollment.student.name} - ${created.amount.toString()}đ`,
      href: "/finance",
      type: "FINANCE"
    })

    return created
  })
}

function parseReceiptBillingPeriod(input: { start?: string; end?: string; label?: string }) {
  try {
    return parseBillingPeriod(input)
  } catch (error) {
    if (error instanceof Error && error.message === receiptCreationErrorCodes.invalidBillingPeriod) {
      throw new ReceiptCreationError(receiptCreationErrorCodes.invalidBillingPeriod)
    }

    throw error
  }
}
