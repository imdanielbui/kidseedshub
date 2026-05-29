import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { toClassProgressSummary } from "@/lib/backend/class-progress"
import { activateParentAccountForStatus, toParentAccountInfo } from "@/lib/backend/parent-account"
import { taskInclude, toTaskItem } from "@/lib/backend/task-mapper"
import { assessmentStatusLabels } from "@/lib/contracts/assessment"
import { attendanceStatusLabels } from "@/lib/contracts/classes"
import type { StudentDetail } from "@/lib/contracts/students"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { studentUpdateSchema } from "@/lib/validations/student"

type RouteContext = {
  params: Promise<{ id: string }>
}

const studentDetailInclude = Prisma.validator<Prisma.StudentInclude>()({
  parent: { include: { user: true } },
  assignedTeacher: true,
  saleOwner: true,
  createdBy: true,
  enrollments: {
    include: {
      course: true,
      attendances: {
        include: {
          classSession: {
            include: {
              class: {
                include: {
                  course: true
                }
              }
            }
          }
        },
        orderBy: { date: "desc" },
        take: 20
      },
      weeklyAssessments: {
        include: {
          items: true,
          teacher: true
        },
        orderBy: [
          { weekNumber: "desc" },
          { updatedAt: "desc" }
        ]
      },
      finalAssessments: {
        include: {
          teacher: true
        },
        orderBy: { createdAt: "desc" }
      }
    }
  },
  classStudents: {
    include: {
      class: {
        include: {
          course: true,
          teacher: true,
          sessions: {
            select: { date: true, status: true },
            orderBy: { date: "asc" }
          }
        }
      }
    }
  },
  photos: { orderBy: { takenAt: "desc" } },
  contactLogs: { include: { loggedBy: true }, orderBy: { createdAt: "desc" } },
  tasks: { include: taskInclude, orderBy: { dueDate: "asc" } }
})

type StudentDetailRecord = Prisma.StudentGetPayload<{ include: typeof studentDetailInclude }>

function toLearningTimeline(student: StudentDetailRecord): StudentDetail["learningTimeline"] {
  const items: StudentDetail["learningTimeline"] = []

  for (const enrollment of student.enrollments) {
    items.push({
      id: `course-${enrollment.id}`,
      type: "course",
      title: `Ghi danh ${enrollment.course.name}`,
      description: `Bắt đầu từ buổi ${enrollment.joinSessionNumber ?? 1}. Quỹ hiện có ${enrollment.sessionsBought} buổi, đã học ${enrollment.sessionsUsed} buổi.`,
      date: (enrollment.startDate ?? enrollment.createdAt).toISOString(),
      meta: enrollment.course.subject,
      subject: enrollment.course.subject
    })

    for (const attendance of enrollment.attendances) {
      const className = attendance.classSession?.class.name
      const topic = attendance.classSession?.topic
      const details = [
        className ? `Lớp ${className}` : undefined,
        topic,
        attendance.note ? `Ghi chú: ${attendance.note}` : undefined
      ].filter(Boolean).join(" · ")

      items.push({
        id: `attendance-${attendance.id}`,
        type: "attendance",
        title: `Điểm danh: ${attendanceStatusLabels[attendance.status]}`,
        description: details || undefined,
        date: attendance.date.toISOString(),
        meta: attendance.classSession?.class.course.name ?? enrollment.course.name,
        status: attendance.status,
        subject: enrollment.course.subject
      })
    }

    for (const assessment of enrollment.weeklyAssessments) {
      const checkedItems = assessment.items.filter((item) => item.checked).length
      const totalItems = assessment.items.length
      const details = [
        assessmentStatusLabels[assessment.status],
        `${checkedItems}/${totalItems} mục đã tick`,
        assessment.comment
      ].filter(Boolean).join(" · ")

      items.push({
        id: `weekly-${assessment.id}`,
        type: "weekly_assessment",
        title: `Đánh giá tuần ${assessment.weekNumber}`,
        description: details,
        date: assessment.updatedAt.toISOString(),
        meta: `${enrollment.course.name} · ${assessment.teacher.name}`,
        status: assessment.status,
        subject: assessment.subject
      })
    }

    for (const assessment of enrollment.finalAssessments) {
      items.push({
        id: `final-${assessment.id}`,
        type: "final_assessment",
        title: "Đánh giá cuối khóa",
        description: `${assessment.completedWeeks}/${assessment.requiredWeeks} tuần đủ điều kiện · ${assessment.teacherSummary}`,
        date: assessment.createdAt.toISOString(),
        meta: `${enrollment.course.name} · ${assessment.teacher.name}`,
        subject: assessment.subject
      })
    }
  }

  for (const photo of student.photos) {
    items.push({
      id: `photo-${photo.id}`,
      type: "photo",
      title: photo.isFeatured ? "Ảnh nổi bật" : "Ảnh buổi học",
      description: photo.attendanceId ? "Gắn với một buổi điểm danh." : undefined,
      date: photo.takenAt.toISOString(),
      meta: "Album"
    })
  }

  return items
    .sort((first, second) => new Date(second.date).getTime() - new Date(first.date).getTime())
    .slice(0, 40)
}

function toAssessmentProgress(student: StudentDetailRecord): StudentDetail["assessmentProgress"] {
  return student.enrollments.map((enrollment) => {
    const subject = enrollment.course.subject
    const weeklyAssessments = enrollment.weeklyAssessments.filter((assessment) => assessment.subject === subject)
    const completedAssessments = weeklyAssessments.filter((assessment) => assessment.status === "COMPLETE")
    const latestWeek = weeklyAssessments.reduce<number | undefined>((latest, assessment) => {
      if (latest === undefined) return assessment.weekNumber
      return Math.max(latest, assessment.weekNumber)
    }, undefined)
    const checkedItems = weeklyAssessments.reduce((total, assessment) => total + assessment.items.filter((item) => item.checked).length, 0)
    const totalItems = weeklyAssessments.reduce((total, assessment) => total + assessment.items.length, 0)
    const finalAssessment = enrollment.finalAssessments.find((assessment) => assessment.subject === subject)

    return {
      enrollmentId: enrollment.id,
      courseName: enrollment.course.name,
      subject,
      completedWeeks: completedAssessments.length,
      totalWeeks: Math.max(0, enrollment.totalCourseSessionsAtJoin ?? enrollment.course.totalSessions),
      latestWeek,
      checkedItems,
      totalItems,
      finalAssessmentId: finalAssessment?.id,
      finalCreatedAt: finalAssessment?.createdAt.toISOString()
    }
  })
}

function toStudentDetail(student: StudentDetailRecord): StudentDetail {
  const activeClassByCourseId = new Map(
    student.classStudents
      .filter((classStudent) => classStudent.isActive && classStudent.class.isActive)
      .map((classStudent) => [classStudent.class.courseId, classStudent.class])
  )
  const courses = student.enrollments.map((enrollment) => ({
    enrollmentId: enrollment.id,
    classId: activeClassByCourseId.get(enrollment.courseId)?.id,
    className: activeClassByCourseId.get(enrollment.courseId)?.name,
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
    classProgress: activeClassByCourseId.get(enrollment.courseId)
      ? toClassProgressSummary(activeClassByCourseId.get(enrollment.courseId)!)
      : undefined,
    isActive: enrollment.isActive
  }))

  return {
    id: student.id,
    code: student.code,
    name: student.name,
    birthDate: student.birthDate?.toISOString(),
    status: student.status,
    gender: student.gender,
    parentName: student.parent.user.name,
    parentPhone: student.parent.user.phone,
    parentEmail: student.parent.user.email ?? undefined,
    parentAccount: toParentAccountInfo(student.parent.user),
    leadSource: student.leadSource ?? undefined,
    leadNote: student.leadNote ?? undefined,
    healthNote: student.healthNote ?? undefined,
    assignedTeacherName: student.assignedTeacher?.name,
    saleOwnerName: student.saleOwner?.name,
    createdByName: student.createdBy?.name,
    sessionsRemaining: courses.filter((course) => course.isActive).reduce((total, course) => total + course.sessionsRemaining, 0),
    courses,
    classes: student.classStudents.map(({ class: klass }) => ({
      id: klass.id,
      name: klass.name,
      courseName: klass.course.name,
      teacherName: klass.teacher.name,
      weekday: klass.weekday,
      startTime: klass.startTime,
      endTime: klass.endTime,
      progress: toClassProgressSummary(klass)
    })),
    photos: student.photos.map((photo) => ({
      id: photo.id,
      url: photo.url,
      attendanceId: photo.attendanceId ?? undefined,
      takenAt: photo.takenAt.toISOString(),
      isFeatured: photo.isFeatured
    })),
    learningTimeline: toLearningTimeline(student),
    assessmentProgress: toAssessmentProgress(student),
    contactLogs: student.contactLogs.map((log) => ({
      id: log.id,
      content: log.content,
      result: log.result,
      loggedByName: log.loggedBy.name,
      createdAt: log.createdAt.toISOString()
    })),
    tasks: student.tasks.map(toTaskItem),
    createdAt: student.createdAt.toISOString(),
    updatedAt: student.updatedAt.toISOString()
  }
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "students:view_all") && !can(session.user.role, "students:view_class")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền xem học viên." }, { status: 403 })
  }

  const { id } = await context.params
  const where: Prisma.StudentWhereUniqueInput = { id }
  const student = await prisma.student.findUnique({
    where,
    include: studentDetailInclude
  })

  if (!student) {
    return fail({ code: "NOT_FOUND", message: "Học viên không tồn tại." }, { status: 404 })
  }

  if (session.user.role === "TEACHER" && student.assignedTeacherId !== session.user.id) {
    return fail({ code: "FORBIDDEN", message: "Bạn chỉ được xem học viên mình phụ trách." }, { status: 403 })
  }

  return ok(toStudentDetail(student))
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "students:edit")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền cập nhật học viên." }, { status: 403 })
  }

  const body = await request.json()
  const parsed = studentUpdateSchema.safeParse(body)

  if (!parsed.success) {
    return fail({ code: "INVALID_BODY", message: "Thông tin cập nhật học viên không hợp lệ." }, { status: 400 })
  }

  const { id } = await context.params

  try {
    const student = await prisma.$transaction(async (tx) => {
      const existing = await tx.student.findUnique({
        where: { id },
        include: { parent: true }
      })

      if (!existing) {
        return null
      }

      const statusChanged = parsed.data.status !== undefined && parsed.data.status !== existing.status
      const shouldActivate = parsed.data.status !== undefined && (parsed.data.status === "CONVERTED" || parsed.data.status === "ACTIVE")

      if (parsed.data.parent || shouldActivate) {
        await tx.user.update({
          where: { id: existing.parent.userId },
          data: {
            name: parsed.data.parent?.name,
            phone: parsed.data.parent?.phone,
            email: parsed.data.parent?.email,
            ...(shouldActivate ? { role: "PARENT" as const, isActive: true } : {})
          }
        })
      }

      await activateParentAccountForStatus(tx, existing.parent.userId, parsed.data.status)

      return tx.student.update({
        where: { id },
        data: {
          name: parsed.data.name,
          birthDate: parsed.data.birthDate === undefined ? undefined : parsed.data.birthDate ? new Date(parsed.data.birthDate) : null,
          status: parsed.data.status,
          stageChangedAt: statusChanged ? new Date() : undefined,
          gender: parsed.data.gender,
          leadSource: parsed.data.leadSource,
          leadNote: parsed.data.leadNote,
          healthNote: parsed.data.healthNote,
          saleOwnerId: parsed.data.saleOwnerId,
          assignedTeacherId: parsed.data.assignedTeacherId
        },
        include: studentDetailInclude
      })
    })

    if (!student) {
      return fail({ code: "NOT_FOUND", message: "Học viên không tồn tại." }, { status: 404 })
    }

    return ok(toStudentDetail(student))
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return fail({ code: "DUPLICATE_PARENT", message: "Số điện thoại hoặc email phụ huynh đã tồn tại." }, { status: 409 })
    }

    throw error
  }
}
