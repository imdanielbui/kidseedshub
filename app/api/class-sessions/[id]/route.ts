import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { createAuditLog, notifyUsers } from "@/lib/backend/activity"
import { classCalendarSessionInclude, dateKey } from "@/lib/backend/class-schedule"
import { syncClassSessionTimesheetEntry } from "@/lib/backend/timesheet"
import type { ClassCalendarSessionItem } from "@/lib/contracts/courses"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { classSessionUpdateSchema } from "@/lib/validations/course"

type RouteContext = {
  params: Promise<{ id: string }>
}

function toCalendarSessionItem(session: {
  id: string
  classId: string
  date: Date
  startTime: string | null
  endTime: string | null
  room: string | null
  status: ClassCalendarSessionItem["status"]
  substituteTeacher?: { name: string } | null
  class: {
    name: string
    course: { name: string; subject: ClassCalendarSessionItem["subject"] }
    teacher: { name: string }
    students: unknown[]
  }
}): ClassCalendarSessionItem {
  return {
    id: session.id,
    classId: session.classId,
    className: session.class.name,
    courseName: session.class.course.name,
    subject: session.class.course.subject,
    teacherName: session.class.teacher.name,
    substituteTeacherName: session.substituteTeacher?.name,
    studentCount: session.class.students.length,
    date: dateKey(session.date),
    weekday: session.date.getDay(),
    startTime: session.startTime ?? "",
    endTime: session.endTime ?? "",
    room: session.room ?? undefined,
    status: session.status
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "courses:manage")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền cập nhật lịch học." }, { status: 403 })
  }

  const body = await request.json()
  const parsed = classSessionUpdateSchema.safeParse(body)

  if (!parsed.success) {
    return fail({ code: "INVALID_BODY", message: "Thông tin buổi học không hợp lệ." }, { status: 400 })
  }

  const { id } = await context.params

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.classSession.findUnique({
        where: { id },
        include: { class: true }
      })

      if (!existing) {
        return null
      }

      if (parsed.data.substituteTeacherId) {
        const substituteTeacher = await tx.user.findFirst({
          where: {
            id: parsed.data.substituteTeacherId,
            isActive: true,
            role: { in: ["ADMIN", "SALE", "TEACHER"] }
          },
          select: { id: true }
        })

        if (!substituteTeacher) {
          throw new Error("SUBSTITUTE_TEACHER_NOT_FOUND")
        }
      }

      const classSession = await tx.classSession.update({
        where: { id },
        data: {
          date: parsed.data.date ? new Date(parsed.data.date) : undefined,
          status: parsed.data.status,
          startTime: parsed.data.startTime,
          endTime: parsed.data.endTime,
          room: parsed.data.room,
          substituteTeacherId: parsed.data.substituteTeacherId
        },
        include: classCalendarSessionInclude
      })

      if (classSession.status === "COMPLETED") {
        await syncClassSessionTimesheetEntry(tx, {
          classSessionId: classSession.id
        })
      }

      if (parsed.data.substituteTeacherId !== undefined && parsed.data.substituteTeacherId !== existing.substituteTeacherId) {
        await createAuditLog(tx, {
          actorId: session.user.id,
          action: "class_session.substitute_teacher.update",
          entityType: "ClassSession",
          entityId: id,
          summary: "Cập nhật giáo viên dạy thay cho buổi học",
          metadata: {
            previousSubstituteTeacherId: existing.substituteTeacherId,
            substituteTeacherId: parsed.data.substituteTeacherId,
            classId: existing.classId
          }
        })

        if (parsed.data.substituteTeacherId) {
          await notifyUsers(tx, {
            recipientIds: [parsed.data.substituteTeacherId],
            actorId: session.user.id,
            title: "Bạn được phân công dạy thay",
            body: `${classSession.class.name} - ${dateKey(classSession.date)}`,
            href: "/classes",
            type: "STAFF_LEAVE"
          })
        }
      }

      return classSession
    })

    if (!updated) {
      return fail({ code: "SESSION_NOT_FOUND", message: "Không tìm thấy buổi học." }, { status: 404 })
    }

    return ok(toCalendarSessionItem(updated))
  } catch (error) {
    if (error instanceof Error && error.message === "SUBSTITUTE_TEACHER_NOT_FOUND") {
      return fail({ code: "SUBSTITUTE_TEACHER_NOT_FOUND", message: "Không tìm thấy giáo viên dạy thay đang hoạt động." }, { status: 404 })
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return fail({ code: "SESSION_NOT_FOUND", message: "Không tìm thấy buổi học." }, { status: 404 })
    }

    throw error
  }
}
