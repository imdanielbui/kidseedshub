import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { createAuditLog } from "@/lib/backend/activity"
import { calculateJoinSessionNumberForClass } from "@/lib/backend/enrollment-join-session"
import type { EnrollmentCreateResult, EnrollmentDeleteResult } from "@/lib/contracts/enrollments"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { enrollmentUpdateSchema } from "@/lib/validations/enrollment"

type RouteContext = {
  params: Promise<{ id: string }>
}

const enrollmentInclude = Prisma.validator<Prisma.EnrollmentInclude>()({
  course: true,
  student: true
})

type EnrollmentRecord = Prisma.EnrollmentGetPayload<{ include: typeof enrollmentInclude }>

function toResult(enrollment: EnrollmentRecord, classAssigned: boolean): EnrollmentCreateResult {
  return {
    enrollment: {
      enrollmentId: enrollment.id,
      courseId: enrollment.courseId,
      courseName: enrollment.course.name,
      courseSubject: enrollment.course.subject,
      courseTotalSessions: enrollment.course.totalSessions,
      coursePrice: enrollment.course.price.toString(),
      sessionsBought: enrollment.sessionsBought,
      sessionsUsed: enrollment.sessionsUsed,
      sessionsRemaining: Math.max(0, enrollment.sessionsBought - enrollment.sessionsUsed),
      joinSessionNumber: enrollment.joinSessionNumber ?? undefined,
      totalCourseSessionsAtJoin: enrollment.totalCourseSessionsAtJoin ?? undefined,
      freeTrialSessions: enrollment.freeTrialSessions,
      paidSessionsBeforeReceipt: enrollment.paidSessionsBeforeReceipt,
      isActive: enrollment.isActive
    },
    studentStatus: enrollment.student.status,
    classAssigned
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "enrollments:manage")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền sửa khóa đã đăng ký." }, { status: 403 })
  }

  const body = await request.json()
  const parsed = enrollmentUpdateSchema.safeParse(body)

  if (!parsed.success) {
    return fail({ code: "INVALID_BODY", message: "Thông tin khóa đã đăng ký không hợp lệ." }, { status: 400 })
  }

  const { id } = await context.params
  const data = parsed.data
  const existing = await prisma.enrollment.findUnique({
    where: { id },
    include: enrollmentInclude
  })

  if (!existing) {
    return fail({ code: "NOT_FOUND", message: "Không tìm thấy khóa đã đăng ký." }, { status: 404 })
  }

  if (data.sessionsBought !== undefined && data.sessionsUsed !== undefined && data.sessionsUsed > data.sessionsBought) {
    return fail({ code: "INVALID_SESSIONS", message: "Số buổi đã học không được lớn hơn số buổi đã cấp." }, { status: 400 })
  }

  const klass = data.classId
    ? await prisma.class.findUnique({ where: { id: data.classId } })
    : null

  if (data.classId && (!klass || !klass.isActive || klass.courseId !== existing.courseId)) {
    return fail({ code: "CLASS_NOT_MATCHED", message: "Lớp học không phù hợp với khóa đã đăng ký." }, { status: 400 })
  }

  const updated = await prisma.$transaction(async (tx) => {
    let nextClassId = data.classId === undefined ? undefined : data.classId || null

    if (data.classId !== undefined) {
      const currentClassStudents = await tx.classStudent.findMany({
        where: {
          studentId: existing.studentId,
          class: { courseId: existing.courseId }
        },
        include: { class: true }
      })

      for (const classStudent of currentClassStudents) {
        if (!data.classId || classStudent.classId !== data.classId) {
          await tx.classStudent.update({
            where: { id: classStudent.id },
            data: { isActive: false }
          })
        }
      }

      if (data.classId) {
        await tx.classStudent.upsert({
          where: {
            classId_studentId: {
              classId: data.classId,
              studentId: existing.studentId
            }
          },
          update: { isActive: true },
          create: {
            classId: data.classId,
            studentId: existing.studentId
          }
        })
      }
    }

    if (nextClassId === undefined) {
      const activeClassStudent = await tx.classStudent.findFirst({
        where: {
          studentId: existing.studentId,
          isActive: true,
          class: { courseId: existing.courseId }
        }
      })
      nextClassId = activeClassStudent?.classId ?? null
    }

    const nextStartDate = data.startDate === undefined
      ? existing.startDate
      : data.startDate
        ? new Date(data.startDate)
        : null
    const shouldRecalculateJoinSession = Boolean(nextClassId) && (data.classId !== undefined || data.startDate !== undefined)
    const joinSessionNumber = shouldRecalculateJoinSession
      ? await calculateJoinSessionNumberForClass(tx, { classId: nextClassId, startDate: nextStartDate })
      : data.joinSessionNumber

    return tx.enrollment.update({
      where: { id },
      data: {
        sessionsBought: data.sessionsBought,
        sessionsUsed: data.sessionsUsed,
        joinSessionNumber,
        totalCourseSessionsAtJoin: data.totalCourseSessionsAtJoin,
        freeTrialSessions: data.freeTrialSessions,
        paidSessionsBeforeReceipt: data.paidSessionsBeforeReceipt,
        startDate: data.startDate === undefined ? undefined : nextStartDate,
        endDate: data.endDate === undefined ? undefined : data.endDate ? new Date(data.endDate) : null,
        isActive: data.isActive
      },
      include: enrollmentInclude
    })
  })

  return ok(toResult(updated, Boolean(data.classId)))
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "enrollments:manage")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền xóa hoặc hủy ghi danh." }, { status: 403 })
  }

  const { id } = await context.params
  const existing = await prisma.enrollment.findUnique({
    where: { id },
    include: enrollmentInclude
  })

  if (!existing) {
    return fail({ code: "NOT_FOUND", message: "Không tìm thấy khóa đã đăng ký." }, { status: 404 })
  }

  const [receiptCount, receiptLineCount, attendanceCount, weeklyAssessmentCount, finalAssessmentCount] = await prisma.$transaction([
    prisma.receipt.count({ where: { enrollmentId: id } }),
    prisma.receiptLine.count({ where: { enrollmentId: id } }),
    prisma.attendance.count({ where: { enrollmentId: id } }),
    prisma.weeklyAssessment.count({ where: { enrollmentId: id } }),
    prisma.finalAssessment.count({ where: { enrollmentId: id } })
  ])
  const relatedCount = receiptCount + receiptLineCount + attendanceCount + weeklyAssessmentCount + finalAssessmentCount

  const result = await prisma.$transaction(async (tx) => {
    await tx.classStudent.updateMany({
      where: {
        studentId: existing.studentId,
        class: { courseId: existing.courseId }
      },
      data: { isActive: false }
    })

    if (relatedCount === 0) {
      await tx.enrollment.delete({ where: { id } })
      await createAuditLog(tx, {
        actorId: session.user.id,
        action: "enrollment.delete",
        entityType: "Enrollment",
        entityId: id,
        summary: `Xóa ghi danh ${existing.course.name} của ${existing.student.name}`,
        metadata: {
          studentId: existing.studentId,
          courseId: existing.courseId
        }
      })

      return {
        mode: "deleted" as const,
        message: "Đã xóa ghi danh vì chưa có phiếu thu, điểm danh hoặc đánh giá liên quan."
      }
    }

    await tx.enrollment.update({
      where: { id },
      data: { isActive: false }
    })
    await createAuditLog(tx, {
      actorId: session.user.id,
      action: "enrollment.cancel",
      entityType: "Enrollment",
      entityId: id,
      summary: `Hủy ghi danh ${existing.course.name} của ${existing.student.name}`,
      metadata: {
        studentId: existing.studentId,
        courseId: existing.courseId,
        receiptCount,
        receiptLineCount,
        attendanceCount,
        weeklyAssessmentCount,
        finalAssessmentCount
      }
    })

    return {
      mode: "canceled" as const,
      message: "Đã hủy ghi danh vì khóa đã có dữ liệu liên quan. Lịch sử vẫn được giữ để báo cáo và đối soát."
    }
  })

  const response: EnrollmentDeleteResult = result

  return ok(response)
}
