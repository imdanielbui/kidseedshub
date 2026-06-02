import { Prisma } from "@prisma/client"
import { dateKey } from "@/lib/backend/class-schedule"
import type { MakeupEntitlementItem } from "@/lib/contracts/makeup-entitlements"
import type { StudentWalletEntryItem } from "@/lib/contracts/student-wallet"

type Tx = Prisma.TransactionClient

export const makeupEntitlementTerminalStatuses = ["COMPLETED", "CREDITED", "REFUNDED", "EXPIRED", "REJECTED"] as const

export const makeupEntitlementInclude = Prisma.validator<Prisma.MakeupEntitlementInclude>()({
  student: { include: { parent: { include: { user: true } } } },
  enrollment: { include: { course: true } },
  attendance: true,
  absenceRequest: true,
  classSession: { include: { class: { include: { teacher: true, course: true } } } },
  resolvedBy: true,
  walletEntries: { include: { createdBy: true }, orderBy: { createdAt: "asc" } },
  refundExpense: true
})

export const studentWalletEntryInclude = Prisma.validator<Prisma.StudentWalletEntryInclude>()({
  student: true,
  createdBy: true,
  makeupEntitlement: true,
  receipt: true
})

export type MakeupEntitlementRecord = Prisma.MakeupEntitlementGetPayload<{ include: typeof makeupEntitlementInclude }>
export type StudentWalletEntryRecord = Prisma.StudentWalletEntryGetPayload<{ include: typeof studentWalletEntryInclude }>

export function isMakeupEntitlementTerminal(status: string) {
  return makeupEntitlementTerminalStatuses.includes(status as (typeof makeupEntitlementTerminalStatuses)[number])
}

export function entitlementMonth(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

export async function getStudentWalletBalance(tx: Tx, studentId: string) {
  const result = await tx.studentWalletEntry.aggregate({
    where: { studentId },
    _sum: { amount: true }
  })

  return result._sum.amount ?? new Prisma.Decimal(0)
}

export function toStudentWalletEntryItem(entry: StudentWalletEntryRecord): StudentWalletEntryItem {
  return {
    id: entry.id,
    studentId: entry.studentId,
    studentCode: entry.student.code,
    studentName: entry.student.name,
    amount: entry.amount.toString(),
    type: entry.type,
    makeupEntitlementId: entry.makeupEntitlementId ?? undefined,
    receiptId: entry.receiptId ?? undefined,
    receiptCode: entry.receipt?.code,
    note: entry.note ?? undefined,
    createdByName: entry.createdBy.name,
    createdAt: entry.createdAt.toISOString()
  }
}

export function toMakeupEntitlementItem(entitlement: MakeupEntitlementRecord): MakeupEntitlementItem {
  const walletCreditAmount = entitlement.walletEntries.reduce(
    (total, entry) => total.plus(entry.amount),
    new Prisma.Decimal(0)
  )

  return {
    id: entitlement.id,
    studentId: entitlement.studentId,
    studentCode: entitlement.student.code,
    studentName: entitlement.student.name,
    parentName: entitlement.student.parent.user.name,
    enrollmentId: entitlement.enrollmentId,
    courseName: entitlement.enrollment.course.name,
    attendanceId: entitlement.attendanceId ?? undefined,
    absenceRequestId: entitlement.absenceRequestId ?? undefined,
    classSessionId: entitlement.classSessionId ?? undefined,
    className: entitlement.classSession?.class.name,
    sessionDate: entitlement.classSession ? dateKey(entitlement.classSession.date) : undefined,
    month: entitlement.month,
    status: entitlement.status,
    isEligible: entitlement.isEligible,
    eligibilityReason: entitlement.eligibilityReason ?? undefined,
    scheduledFor: entitlement.scheduledFor?.toISOString(),
    resolvedAmount: entitlement.resolvedAmount?.toString(),
    resolvedByName: entitlement.resolvedBy?.name,
    resolvedAt: entitlement.resolvedAt?.toISOString(),
    note: entitlement.note ?? undefined,
    walletCreditAmount: walletCreditAmount.toString(),
    refundExpenseCode: entitlement.refundExpense?.code,
    createdAt: entitlement.createdAt.toISOString(),
    updatedAt: entitlement.updatedAt.toISOString()
  }
}

async function getMakeupEntitlementById(tx: Tx, id: string) {
  return tx.makeupEntitlement.findUniqueOrThrow({
    where: { id },
    include: makeupEntitlementInclude
  })
}

function nextStatus(isEligible: boolean, scheduledFor?: Date | null) {
  if (!isEligible) {
    return "REJECTED" as const
  }

  return scheduledFor ? "SCHEDULED" as const : "PENDING_SCHEDULE" as const
}

export async function ensureMakeupEntitlementForExcusedAttendance(
  tx: Tx,
  input: {
    attendanceId: string
    absenceRequestId?: string
    studentId: string
    enrollmentId: string
    classSessionId?: string | null
    sessionDate: Date
    scheduledFor?: Date | null
    actorId: string
    overrideEligibility?: boolean
    eligibilityReason?: string
    note?: string
  }
) {
  const lookup = [
    { attendanceId: input.attendanceId },
    ...(input.absenceRequestId ? [{ absenceRequestId: input.absenceRequestId }] : [])
  ]
  const existing = await tx.makeupEntitlement.findFirst({
    where: { OR: lookup }
  })

  if (existing && isMakeupEntitlementTerminal(existing.status) && !input.overrideEligibility) {
    return getMakeupEntitlementById(tx, existing.id)
  }

  const month = entitlementMonth(input.sessionDate)
  const existingEligibleCount = await tx.makeupEntitlement.count({
    where: {
      studentId: input.studentId,
      month,
      isEligible: true,
      ...(existing ? { NOT: { id: existing.id } } : {})
    }
  })
  const isEligible = input.overrideEligibility || existingEligibleCount === 0
  const eligibilityReason = input.eligibilityReason
    ?? (isEligible ? "First approved absence in month." : "Only the first approved absence each month is makeup-eligible.")
  const status = nextStatus(isEligible, input.scheduledFor)

  const saved = existing
    ? await tx.makeupEntitlement.update({
        where: { id: existing.id },
        data: {
          studentId: input.studentId,
          enrollmentId: input.enrollmentId,
          attendanceId: input.attendanceId,
          absenceRequestId: input.absenceRequestId,
          classSessionId: input.classSessionId,
          month,
          status,
          isEligible,
          eligibilityReason,
          scheduledFor: input.scheduledFor ?? null,
          resolvedAt: status === "REJECTED" ? new Date() : null,
          resolvedById: status === "REJECTED" ? input.actorId : null,
          note: input.note ?? existing.note
        }
      })
    : await tx.makeupEntitlement.create({
        data: {
          studentId: input.studentId,
          enrollmentId: input.enrollmentId,
          attendanceId: input.attendanceId,
          absenceRequestId: input.absenceRequestId,
          classSessionId: input.classSessionId,
          month,
          status,
          isEligible,
          eligibilityReason,
          scheduledFor: input.scheduledFor ?? null,
          resolvedAt: status === "REJECTED" ? new Date() : null,
          resolvedById: status === "REJECTED" ? input.actorId : null,
          note: input.note
        }
      })

  return getMakeupEntitlementById(tx, saved.id)
}

export async function rejectOpenMakeupEntitlementForAttendance(
  tx: Tx,
  input: {
    attendanceId: string
    actorId: string
    note: string
  }
) {
  const existing = await tx.makeupEntitlement.findUnique({
    where: { attendanceId: input.attendanceId }
  })

  if (!existing || isMakeupEntitlementTerminal(existing.status)) {
    return null
  }

  const updated = await tx.makeupEntitlement.update({
    where: { id: existing.id },
    data: {
      status: "REJECTED",
      isEligible: false,
      eligibilityReason: input.note,
      resolvedAt: new Date(),
      resolvedById: input.actorId,
      note: input.note
    }
  })

  return getMakeupEntitlementById(tx, updated.id)
}

export async function syncMakeupEntitlementScheduleForAttendance(
  tx: Tx,
  input: {
    attendanceId: string
    scheduledFor: Date | null
  }
) {
  const existing = await tx.makeupEntitlement.findUnique({
    where: { attendanceId: input.attendanceId }
  })

  if (!existing || isMakeupEntitlementTerminal(existing.status)) {
    return null
  }

  const updated = await tx.makeupEntitlement.update({
    where: { id: existing.id },
    data: {
      scheduledFor: input.scheduledFor,
      status: input.scheduledFor ? "SCHEDULED" : "PENDING_SCHEDULE",
      resolvedAt: null,
      resolvedById: null
    }
  })

  return getMakeupEntitlementById(tx, updated.id)
}
