import { Prisma } from "@prisma/client"
import { createAuditLog } from "@/lib/backend/activity"
import type { EnrollmentHoldItem } from "@/lib/contracts/enrollment-holds"

type Tx = Prisma.TransactionClient

const holdInclude = Prisma.validator<Prisma.EnrollmentHoldInclude>()({
  enrollment: { include: { course: true } },
  sourceClass: true,
  resumedClass: true,
  createdBy: true,
  resumedBy: true
})

type HoldRecord = Prisma.EnrollmentHoldGetPayload<{ include: typeof holdInclude }>

function addMonths(date: Date, months: number) {
  const expiresAt = new Date(date)
  expiresAt.setMonth(expiresAt.getMonth() + months)
  return expiresAt
}

export function toEnrollmentHoldItem(hold: HoldRecord): EnrollmentHoldItem {
  return {
    id: hold.id,
    enrollmentId: hold.enrollmentId,
    courseName: hold.enrollment.course.name,
    sourceClassName: hold.sourceClass?.name,
    resumedClassName: hold.resumedClass?.name,
    remainingSessions: hold.remainingSessions,
    creditAmount: hold.creditAmount.toString(),
    holdMonths: hold.holdMonths,
    expiresAt: hold.expiresAt.toISOString(),
    status: hold.status,
    reason: hold.reason,
    createdByName: hold.createdBy.name,
    resumedByName: hold.resumedBy?.name,
    resumedAt: hold.resumedAt?.toISOString(),
    createdAt: hold.createdAt.toISOString()
  }
}

export async function listEnrollmentHolds(tx: Tx, studentId: string) {
  const now = new Date()
  await tx.enrollmentHold.updateMany({ where: { studentId, status: "ACTIVE", expiresAt: { lt: now } }, data: { status: "EXPIRED" } })
  return tx.enrollmentHold.findMany({ where: { studentId }, include: holdInclude, orderBy: { createdAt: "desc" }, take: 20 })
}

export async function createEnrollmentHold(tx: Tx, input: { enrollmentId: string; holdMonths: number; reason: string; actorId: string }) {
  const enrollment = await tx.enrollment.findUnique({ where: { id: input.enrollmentId }, include: { course: true, student: true } })
  if (!enrollment) throw new Error("ENROLLMENT_NOT_FOUND")
  if (!enrollment.isActive) throw new Error("ENROLLMENT_INACTIVE")
  const existing = await tx.enrollmentHold.findFirst({ where: { enrollmentId: enrollment.id, status: "ACTIVE", expiresAt: { gte: new Date() } } })
  if (existing) throw new Error("HOLD_ALREADY_ACTIVE")

  const sourceClassStudent = await tx.classStudent.findFirst({ where: { studentId: enrollment.studentId, isActive: true, class: { courseId: enrollment.courseId } } })
  const remainingSessions = Math.max(0, enrollment.sessionsBought - enrollment.sessionsUsed)
  const creditAmount = enrollment.course.totalSessions > 0
    ? enrollment.course.price.div(enrollment.course.totalSessions).mul(remainingSessions)
    : new Prisma.Decimal(0)
  const now = new Date()
  const hold = await tx.enrollmentHold.create({
    data: { studentId: enrollment.studentId, enrollmentId: enrollment.id, sourceClassId: sourceClassStudent?.classId, remainingSessions, creditAmount, holdMonths: input.holdMonths, expiresAt: addMonths(now, input.holdMonths), reason: input.reason, createdById: input.actorId },
    include: holdInclude
  })
  await tx.classStudent.updateMany({ where: { studentId: enrollment.studentId, class: { courseId: enrollment.courseId } }, data: { isActive: false } })
  await tx.enrollment.update({ where: { id: enrollment.id }, data: { isActive: false } })
  await createAuditLog(tx, { actorId: input.actorId, action: "enrollment.hold", entityType: "EnrollmentHold", entityId: hold.id, summary: `Bảo lưu ${enrollment.student.name}`, metadata: { enrollmentId: enrollment.id, remainingSessions, creditAmount: creditAmount.toString(), holdMonths: input.holdMonths, expiresAt: hold.expiresAt.toISOString() } })
  return hold
}

export async function resumeEnrollmentHold(tx: Tx, input: { holdId: string; classId: string; actorId: string }) {
  const hold = await tx.enrollmentHold.findUnique({ where: { id: input.holdId }, include: holdInclude })
  if (!hold) throw new Error("HOLD_NOT_FOUND")
  if (hold.status !== "ACTIVE" || hold.expiresAt < new Date()) {
    if (hold.status === "ACTIVE") await tx.enrollmentHold.update({ where: { id: hold.id }, data: { status: "EXPIRED" } })
    throw new Error("HOLD_EXPIRED")
  }
  const targetClass = await tx.class.findUnique({ where: { id: input.classId } })
  if (!targetClass || !targetClass.isActive || targetClass.courseId !== hold.enrollment.courseId) throw new Error("CLASS_NOT_MATCHED")
  await tx.classStudent.updateMany({ where: { studentId: hold.studentId, class: { courseId: hold.enrollment.courseId } }, data: { isActive: false } })
  await tx.classStudent.upsert({ where: { classId_studentId: { classId: targetClass.id, studentId: hold.studentId } }, update: { isActive: true }, create: { classId: targetClass.id, studentId: hold.studentId } })
  await tx.enrollment.update({ where: { id: hold.enrollmentId }, data: { isActive: true } })
  const resumed = await tx.enrollmentHold.update({ where: { id: hold.id }, data: { status: "RESUMED", resumedClassId: targetClass.id, resumedById: input.actorId, resumedAt: new Date() }, include: holdInclude })
  await createAuditLog(tx, { actorId: input.actorId, action: "enrollment.resume_hold", entityType: "EnrollmentHold", entityId: resumed.id, summary: `Mở lại bảo lưu cho enrollment ${hold.enrollmentId}`, metadata: { enrollmentId: hold.enrollmentId, classId: targetClass.id } })
  return resumed
}
