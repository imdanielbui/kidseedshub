import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { calculateJoinSessionNumberForClass } from "@/lib/backend/enrollment-join-session"
import type { EnrollmentCreateResult } from "@/lib/contracts/enrollments"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { enrollmentCreateSchema } from "@/lib/validations/enrollment"

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

function nextStudentStatus(currentStatus: EnrollmentRecord["student"]["status"], sessionsBought: number) {
  if (sessionsBought > 0) {
    return "ACTIVE"
  }

  if (currentStatus === "LEAD" || currentStatus === "TRIAL" || currentStatus === "EVALUATION") {
    return "CONVERTED"
  }

  return currentStatus
}

export async function POST(request: Request) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "enrollments:manage")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền ghi danh khóa học." }, { status: 403 })
  }

  const body = await request.json()
  const parsed = enrollmentCreateSchema.safeParse(body)

  if (!parsed.success) {
    return fail({ code: "INVALID_BODY", message: "Thông tin ghi danh không hợp lệ." }, { status: 400 })
  }

  const data = parsed.data
  const [student, course, existingEnrollment, klass] = await prisma.$transaction([
    prisma.student.findUnique({ where: { id: data.studentId } }),
    prisma.course.findUnique({ where: { id: data.courseId } }),
    prisma.enrollment.findFirst({
      where: {
        studentId: data.studentId,
        courseId: data.courseId,
        isActive: true
      }
    }),
    data.classId ? prisma.class.findUnique({ where: { id: data.classId } }) : prisma.class.findFirst({ where: { id: "__none__" } })
  ])

  if (!student) {
    return fail({ code: "STUDENT_NOT_FOUND", message: "Không tìm thấy học viên." }, { status: 404 })
  }

  if (!course || !course.isActive) {
    return fail({ code: "COURSE_NOT_FOUND", message: "Khóa học không tồn tại hoặc đang tắt." }, { status: 404 })
  }

  if (existingEnrollment) {
    return fail({ code: "ACTIVE_ENROLLMENT_EXISTS", message: "Học viên đã có enrollment active cho khóa học này." }, { status: 409 })
  }

  if (data.classId && (!klass || !klass.isActive || klass.courseId !== data.courseId)) {
    return fail({ code: "CLASS_NOT_MATCHED", message: "Lớp học không phù hợp với khóa học đã chọn." }, { status: 400 })
  }

  const enrollment = await prisma.$transaction(async (tx) => {
    const startDate = data.startDate ? new Date(data.startDate) : undefined
    const joinSessionNumber = data.classId
      ? await calculateJoinSessionNumberForClass(tx, { classId: data.classId, startDate })
      : data.joinSessionNumber

    const created = await tx.enrollment.create({
      data: {
        studentId: data.studentId,
        courseId: data.courseId,
        sessionsBought: data.sessionsBought,
        joinSessionNumber,
        totalCourseSessionsAtJoin: data.totalCourseSessionsAtJoin ?? course.totalSessions,
        freeTrialSessions: data.freeTrialSessions,
        paidSessionsBeforeReceipt: data.paidSessionsBeforeReceipt,
        startDate,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        isActive: true
      },
      include: enrollmentInclude
    })

    if (data.classId) {
      await tx.classStudent.upsert({
        where: {
          classId_studentId: {
            classId: data.classId,
            studentId: data.studentId
          }
        },
        update: { isActive: true },
        create: {
          classId: data.classId,
          studentId: data.studentId
        }
      })
    }

    const status = nextStudentStatus(created.student.status, data.sessionsBought)

    if (status !== created.student.status) {
      await tx.student.update({
        where: { id: data.studentId },
        data: { status }
      })

      return {
        ...created,
        student: {
          ...created.student,
          status
        }
      }
    }

    return created
  })

  return ok(toResult(enrollment, Boolean(data.classId)), { status: 201 })
}
