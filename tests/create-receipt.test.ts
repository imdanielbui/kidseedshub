import assert from "node:assert/strict"
import test from "node:test"
import { Prisma } from "@prisma/client"
import { createReceipt } from "../lib/modules/finance/application/create-receipt"
import { ReceiptCreationError, receiptCreationErrorCodes } from "../lib/modules/finance/application/receipt-errors"
import type { receiptCreateSchema } from "../lib/validations/finance"
import type { z } from "zod"

type ReceiptCreateInput = z.infer<typeof receiptCreateSchema>

const baseEnrollment = {
  id: "enrollment-1",
  studentId: "student-1",
  courseId: "course-1",
  sessionsBought: 0,
  sessionsUsed: 0,
  freeTrialSessions: 0,
  paidSessionsBeforeReceipt: 0,
  joinSessionNumber: 1,
  startDate: new Date("2026-06-01T00:00:00.000Z"),
  course: {
    id: "course-1",
    name: "Robotics Core",
    price: new Prisma.Decimal(1_200_000),
    totalSessions: 12
  },
  student: {
    id: "student-1",
    name: "Nguyen An",
    status: "TRIAL"
  }
}

const baseInput: ReceiptCreateInput = {
  studentId: "student-1",
  method: "BANK_TRANSFER",
  walletCreditAmount: 0,
  discountAmount: 0,
  discountPercent: 0,
  freeTrialSessions: 0,
  paidSessionsBeforeReceipt: 0,
  lines: [{
    enrollmentId: "enrollment-1",
    billableSessions: 4,
    freeTrialSessions: 0,
    paidSessionsBeforeReceipt: 1
  }],
  extraLines: [{
    type: "TUTORING",
    description: "Phụ đạo 2 giờ",
    quantity: 2,
    unitPrice: 150_000
  }]
}

test("createReceipt creates course and extra lines while updating session balance", async () => {
  const captured: { receiptData?: Record<string, unknown>; enrollmentUpdate?: Record<string, unknown> } = {}
  const tx = createTx({
    enrollments: [baseEnrollment],
    onReceiptCreate(data) {
      captured.receiptData = data
    },
    onEnrollmentUpdate(data) {
      captured.enrollmentUpdate = data
    }
  })

  const receipt = await createReceipt({
    prisma: createPrisma(tx),
    data: baseInput,
    createdById: "admin-1",
    deps: createDeps()
  })

  const receiptData = captured.receiptData as {
    amount: Prisma.Decimal
    grossAmount: Prisma.Decimal
    sessions: number
    lines: { create: Array<{ amount: Prisma.Decimal; billableSessions: number; paidSessionsBeforeReceipt: number }> }
    extraLines: { create: Array<{ amount: Prisma.Decimal; quantity: Prisma.Decimal; unitPrice: Prisma.Decimal }> }
  }
  const enrollmentUpdate = captured.enrollmentUpdate as {
    sessionsBought: { increment: number }
    sessionsUsed: { increment: number }
  }

  assert.equal(receipt.code, "PT-2026-001")
  assert.equal(receiptData.amount.toString(), "700000")
  assert.equal(receiptData.grossAmount.toString(), "700000")
  assert.equal(receiptData.sessions, 4)
  assert.equal(receiptData.lines.create[0].amount.toString(), "400000")
  assert.equal(receiptData.lines.create[0].billableSessions, 4)
  assert.equal(receiptData.lines.create[0].paidSessionsBeforeReceipt, 1)
  assert.equal(receiptData.extraLines.create[0].amount.toString(), "300000")
  assert.equal(enrollmentUpdate.sessionsBought.increment, 4)
  assert.equal(enrollmentUpdate.sessionsUsed.increment, 1)
})

test("createReceipt rejects wallet credit above available balance", async () => {
  await assert.rejects(
    createReceipt({
      prisma: createPrisma(createTx({ enrollments: [baseEnrollment] })),
      data: { ...baseInput, walletCreditAmount: 500_000 },
      createdById: "admin-1",
      deps: createDeps({
        getWalletBalance: async () => new Prisma.Decimal(100_000)
      })
    }),
    (error) => error instanceof ReceiptCreationError && error.code === receiptCreationErrorCodes.walletCreditExceedsBalance
  )
})

test("createReceipt rejects one receipt across multiple students", async () => {
  await assert.rejects(
    createReceipt({
      prisma: createPrisma(createTx({
        enrollments: [
          baseEnrollment,
          {
            ...baseEnrollment,
            id: "enrollment-2",
            studentId: "student-2",
            courseId: "course-2",
            course: { ...baseEnrollment.course, id: "course-2" },
            student: { ...baseEnrollment.student, id: "student-2" }
          }
        ]
      })),
      data: {
        ...baseInput,
        lines: [
          { enrollmentId: "enrollment-1", billableSessions: 1, freeTrialSessions: 0, paidSessionsBeforeReceipt: 0 },
          { enrollmentId: "enrollment-2", billableSessions: 1, freeTrialSessions: 0, paidSessionsBeforeReceipt: 0 }
        ]
      },
      createdById: "admin-1",
      deps: createDeps()
    }),
    (error) => error instanceof ReceiptCreationError && error.code === receiptCreationErrorCodes.multiStudentReceipt
  )
})

function createPrisma(tx: unknown) {
  return {
    $transaction: async <T>(callback: (transaction: never) => Promise<T>) => callback(tx as never)
  }
}

function createDeps(overrides: Partial<NonNullable<Parameters<typeof createReceipt>[0]["deps"]>> = {}) {
  return {
    nextCode: async () => "PT-2026-001",
    getWalletBalance: async () => new Prisma.Decimal(1_000_000),
    countBillingSessions: async () => undefined,
    createAudit: async () => ({}),
    notify: async () => ({ count: 0 }),
    getStaffRecipientIds: async () => [],
    ...overrides
  }
}

function createTx({
  enrollments,
  onReceiptCreate,
  onEnrollmentUpdate
}: {
  enrollments: typeof baseEnrollment[]
  onReceiptCreate?: (data: Record<string, unknown>) => void
  onEnrollmentUpdate?: (data: Record<string, unknown>) => void
}) {
  return {
    enrollment: {
      findMany: async () => enrollments,
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        onEnrollmentUpdate?.(data)
        const enrollment = enrollments.find((item) => item.id === where.id) ?? enrollments[0]
        return { ...enrollment, student: enrollment.student }
      }
    },
    student: {
      update: async () => ({})
    },
    receipt: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        onReceiptCreate?.(data)
        const firstEnrollment = enrollments[0]
        return {
          id: "receipt-1",
          code: data.code,
          enrollmentId: firstEnrollment.id,
          amount: data.amount,
          grossAmount: data.grossAmount,
          discountAmount: data.discountAmount,
          discountPercent: data.discountPercent,
          walletCreditAmount: data.walletCreditAmount,
          sessions: data.sessions,
          billableSessions: data.billableSessions,
          freeTrialSessions: data.freeTrialSessions,
          paidSessionsBeforeReceipt: data.paidSessionsBeforeReceipt,
          remainingSessionsAfterReceipt: data.remainingSessionsAfterReceipt,
          method: data.method,
          note: data.note,
          createdAt: new Date("2026-06-13T00:00:00.000Z"),
          createdBy: { name: "Admin" },
          enrollment: {
            ...firstEnrollment,
            student: {
              ...firstEnrollment.student,
              code: "KS26-001",
              parent: { user: { name: "Parent", phone: "0900000000" } }
            }
          },
          lines: [],
          extraLines: []
        }
      }
    },
    studentWalletEntry: {
      create: async () => ({})
    }
  }
}
