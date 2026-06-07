import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { classCalendarSessionInclude, dateKey } from "@/lib/backend/class-schedule"
import { filterSessionsOutsideBlockedDates } from "@/lib/backend/class-session-visibility"
import type { ClassCalendarSessionItem } from "@/lib/contracts/courses"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { classSessionListQuerySchema } from "@/lib/validations/course"

function monthRange(month?: string) {
  const now = new Date()
  const [year, monthIndex] = month ? month.split("-").map(Number) : [now.getFullYear(), now.getMonth() + 1]
  const start = new Date(year, monthIndex - 1, 1)
  const end = new Date(year, monthIndex, 0, 23, 59, 59, 999)
  return { start, end }
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

export async function GET(request: Request) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "students:view_all") && !can(session.user.role, "students:view_class")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền xem lịch học." }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const parsed = classSessionListQuerySchema.safeParse(Object.fromEntries(searchParams))

  if (!parsed.success) {
    return fail({ code: "INVALID_QUERY", message: "Bộ lọc lịch học không hợp lệ." }, { status: 400 })
  }

  const range = monthRange(parsed.data.month)
  const blockedEvents = await prisma.scheduleEvent.findMany({
    where: {
      affectsScheduling: true,
      date: {
        gte: range.start,
        lte: range.end
      }
    },
    select: { date: true }
  })
  const blockedDateKeys = new Set(blockedEvents.map((event) => dateKey(event.date)))
  const sessions = await prisma.classSession.findMany({
    where: {
      date: {
        gte: range.start,
        lte: range.end
      },
      class: {
        isActive: true
      },
      ...(session.user.role === "TEACHER" ? { OR: [{ class: { teacherId: session.user.id } }, { substituteTeacherId: session.user.id }] } : {})
    },
    include: classCalendarSessionInclude,
    orderBy: [{ date: "asc" }, { startTime: "asc" }]
  })

  return ok(filterSessionsOutsideBlockedDates(sessions, blockedDateKeys).map(toCalendarSessionItem))
}
