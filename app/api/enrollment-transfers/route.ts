import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { createAuditLog } from "@/lib/backend/activity"
import { getStudentWalletBalance } from "@/lib/backend/makeup-entitlement"
import type { EnrollmentTransferResult } from "@/lib/contracts/enrollment-transfers"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { enrollmentTransferCreateSchema } from "@/lib/validations/enrollment-transfer"

const enrollmentInclude = Prisma.validator<Prisma.EnrollmentInclude>()({
  course: true,
  student: true
})

type EnrollmentRecord = Prisma.EnrollmentGetPayload<{ include: typeof enrollmentInclude }>

function toCourseBalance(enrollment: EnrollmentRecord, klass?: { id: string; name: string }) {
  return {
    enrollmentId: enrollment.id,
    classId: klass?.id,
    className: klass?.name,
    courseId: enrollment.courseId,
    courseName: enrollment.course.name,
    courseSubject: enrollment.course.subject,
    courseTotalSessions: enrollment.course.totalSessions,
    coursePrice: enrollment.course.price.toString(),
    sessionsBought: enrollment.sessionsBought,
    sessionsUsed: enrollment.sessionsUsed,
    sessionsRemaining: Math.max(0, enrollment.sessionsBought - enrollment.sessionsUsed),
    startDate: enrollment.startDate?.toISOString(),
    endDate: enrollment.endDate?.toISOString(),
    joinSessionNumber: enrollment.joinSessionNumber ?? undefined,
    totalCourseSessionsAtJoin: enrollment.totalCourseSessionsAtJoin ?? undefined,
    freeTrialSessions: enrollment.freeTrialSessions,
    paidSessionsBeforeReceipt: enrollment.paidSessionsBeforeReceipt,
    isActive: enrollment.isActive
  }
}

export async function POST(request: Request) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "enrollments:manage") || !can(session.user.role, "wallet:apply_credit")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền chuyển lớp/khóa và ghi credit." }, { status: 403 })
  }

  const body = await request.json()
  const parsed = enrollmentTransferCreateSchema.safeParse(body)

  if (!parsed.success) {
    return fail({ code: "INVALID_BODY", message: "Thông tin chuyển lớp/khóa không hợp lệ." }, { status: 400 })
  }

  const data = parsed.data

  try {
    const result = await prisma.$transaction(async (tx) => {
      const fromEnrollment = await tx.enrollment.findUnique({
        where: { id: data.fromEnrollmentId },
        include: enrollmentInclude
      })

      if (!fromEnrollment) {
        throw new Error("FROM_ENROLLMENT_NOT_FOUND")
      }

      if (!fromEnrollment.isActive) {
        throw new Error("FROM_ENROLLMENT_INACTIVE")
      }

      const [toCourse, toClass, fromClassStudent, activeTargetEnrollment] = await Promise.all([
        tx.course.findUnique({ where: { id: data.toCourseId } }),
        data.toClassId ? tx.class.findUnique({ where: { id: data.toClassId } }) : null,
        tx.classStudent.findFirst({
          where: {
            studentId: fromEnrollment.studentId,
            isActive: true,
            class: { courseId: fromEnrollment.courseId }
          },
          include: { class: true }
        }),
        tx.enrollment.findFirst({
          where: {
            studentId: fromEnrollment.studentId,
            courseId: data.toCourseId,
            isActive: true,
            id: { not: fromEnrollment.id }
          }
        })
      ])

      if (!toCourse || !toCourse.isActive) {
        throw new Error("TO_COURSE_NOT_FOUND")
      }

      if (data.toClassId && (!toClass || !toClass.isActive || toClass.courseId !== toCourse.id)) {
        throw new Error("TO_CLASS_NOT_MATCHED")
      }

      const isCourseTransfer = toCourse.id !== fromEnrollment.courseId

      if (!isCourseTransfer && !toClass) {
        throw new Error("TARGET_CLASS_REQUIRED")
      }

      if (!isCourseTransfer && toClass?.id === fromClassStudent?.classId) {
        throw new Error("SAME_CLASS")
      }

      if (isCourseTransfer && activeTargetEnrollment) {
        throw new Error("ACTIVE_TARGET_ENROLLMENT_EXISTS")
      }

      await tx.classStudent.updateMany({
        where: {
          studentId: fromEnrollment.studentId,
          class: { courseId: fromEnrollment.courseId }
        },
        data: { isActive: false }
      })

      if (toClass) {
        await tx.classStudent.upsert({
          where: {
            classId_studentId: {
              classId: toClass.id,
              studentId: fromEnrollment.studentId
            }
          },
          update: { isActive: true },
          create: {
            classId: toClass.id,
            studentId: fromEnrollment.studentId
          }
        })
      }

      const remainingSessions = Math.max(0, fromEnrollment.sessionsBought - fromEnrollment.sessionsUsed)
      const unitPrice = fromEnrollment.course.totalSessions > 0
        ? fromEnrollment.course.price.div(fromEnrollment.course.totalSessions)
        : new Prisma.Decimal(0)
      const creditAmount = isCourseTransfer ? unitPrice.mul(remainingSessions) : new Prisma.Decimal(0)
      let toEnrollment = fromEnrollment

      if (isCourseTransfer) {
        await tx.enrollment.update({
          where: { id: fromEnrollment.id },
          data: { isActive: false, endDate: new Date() }
        })

        toEnrollment = await tx.enrollment.create({
          data: {
            studentId: fromEnrollment.studentId,
            courseId: toCourse.id,
            sessionsBought: 0,
            sessionsUsed: 0,
            joinSessionNumber: 1,
            totalCourseSessionsAtJoin: toCourse.totalSessions,
            freeTrialSessions: 0,
            paidSessionsBeforeReceipt: 0,
            startDate: data.startDate ? new Date(data.startDate) : new Date(),
            isActive: true
          },
          include: enrollmentInclude
        })

        if (creditAmount.greaterThan(0)) {
          await tx.studentWalletEntry.create({
            data: {
              studentId: fromEnrollment.studentId,
              amount: creditAmount,
              type: "CREDIT",
              note: `Credit chuyển từ ${fromEnrollment.course.name} sang ${toCourse.name}. Lý do: ${data.reason}`,
              createdById: session.user.id
            }
          })
        }
      }

      const transfer = await tx.enrollmentTransfer.create({
        data: {
          studentId: fromEnrollment.studentId,
          fromEnrollmentId: fromEnrollment.id,
          toEnrollmentId: toEnrollment.id,
          fromClassId: fromClassStudent?.classId,
          toClassId: toClass?.id,
          remainingSessions,
          creditAmount,
          reason: data.reason,
          createdById: session.user.id
        },
        include: { createdBy: true }
      })

      await createAuditLog(tx, {
        actorId: session.user.id,
        action: isCourseTransfer ? "enrollment.transfer_course" : "enrollment.transfer_class",
        entityType: "EnrollmentTransfer",
        entityId: transfer.id,
        summary: `${isCourseTransfer ? "Chuyển khóa" : "Chuyển lớp"} cho ${fromEnrollment.student.name}`,
        metadata: {
          studentId: fromEnrollment.studentId,
          fromEnrollmentId: fromEnrollment.id,
          toEnrollmentId: toEnrollment.id,
          fromClassId: fromClassStudent?.classId,
          toClassId: toClass?.id,
          remainingSessions,
          creditAmount: creditAmount.toString()
        }
      })

      const walletBalance = await getStudentWalletBalance(tx, fromEnrollment.studentId)

      return {
        transfer,
        toEnrollment,
        toClass: toClass ? { id: toClass.id, name: toClass.name } : undefined,
        isCourseTransfer,
        walletBalance
      }
    })

    const response: EnrollmentTransferResult = {
      id: result.transfer.id,
      studentId: result.transfer.studentId,
      fromEnrollmentId: result.transfer.fromEnrollmentId,
      toEnrollmentId: result.transfer.toEnrollmentId ?? undefined,
      fromClassId: result.transfer.fromClassId ?? undefined,
      toClassId: result.transfer.toClassId ?? undefined,
      isCourseTransfer: result.isCourseTransfer,
      remainingSessions: result.transfer.remainingSessions,
      creditAmount: result.transfer.creditAmount.toString(),
      walletBalanceAfterTransfer: result.walletBalance.toString(),
      reason: result.transfer.reason,
      createdByName: result.transfer.createdBy.name,
      createdAt: result.transfer.createdAt.toISOString(),
      enrollment: toCourseBalance(result.toEnrollment, result.toClass)
    }

    return ok(response, { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "FROM_ENROLLMENT_NOT_FOUND") return fail({ code: error.message, message: "Không tìm thấy khóa/lớp hiện tại." }, { status: 404 })
      if (error.message === "FROM_ENROLLMENT_INACTIVE") return fail({ code: error.message, message: "Khóa hiện tại đã tạm dừng, không thể chuyển tiếp." }, { status: 400 })
      if (error.message === "TO_COURSE_NOT_FOUND") return fail({ code: error.message, message: "Khóa mới không tồn tại hoặc đang tắt." }, { status: 404 })
      if (error.message === "TO_CLASS_NOT_MATCHED") return fail({ code: error.message, message: "Lớp mới không phù hợp với khóa mới." }, { status: 400 })
      if (error.message === "TARGET_CLASS_REQUIRED") return fail({ code: error.message, message: "Cần chọn lớp mới khi chuyển trong cùng khóa." }, { status: 400 })
      if (error.message === "SAME_CLASS") return fail({ code: error.message, message: "Bé đang ở lớp này, hãy chọn lớp khác." }, { status: 400 })
      if (error.message === "ACTIVE_TARGET_ENROLLMENT_EXISTS") return fail({ code: error.message, message: "Bé đã có khóa mới đang hoạt động. Hãy kiểm tra lại hồ sơ trước khi chuyển." }, { status: 409 })
    }

    throw error
  }
}
