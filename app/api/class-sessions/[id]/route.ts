import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { classCalendarSessionInclude, dateKey } from "@/lib/backend/class-schedule"
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
    const updated = await prisma.classSession.update({
      where: { id },
      data: {
        date: parsed.data.date ? new Date(parsed.data.date) : undefined,
        status: parsed.data.status,
        startTime: parsed.data.startTime,
        endTime: parsed.data.endTime,
        room: parsed.data.room
      },
      include: classCalendarSessionInclude
    })

    return ok(toCalendarSessionItem(updated))
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return fail({ code: "SESSION_NOT_FOUND", message: "Không tìm thấy buổi học." }, { status: 404 })
    }

    throw error
  }
}
