import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { normalizeScheduleSlots, replaceClassSchedule } from "@/lib/backend/class-schedule"
import type { ClassListItem } from "@/lib/contracts/courses"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { classCreateSchema, classListQuerySchema } from "@/lib/validations/course"

const classListInclude = Prisma.validator<Prisma.ClassInclude>()({
  course: true,
  teacher: true,
  sessions: {
    select: { date: true, status: true },
    orderBy: { date: "asc" }
  },
  scheduleSlots: { orderBy: [{ weekday: "asc" }, { startTime: "asc" }] },
  students: { include: { student: { include: { parent: { include: { user: true } } } } } },
  _count: { select: { sessions: true } }
})

const classSummaryInclude = Prisma.validator<Prisma.ClassInclude>()({
  course: true,
  teacher: true,
  sessions: {
    select: { date: true, status: true },
    orderBy: { date: "asc" }
  },
  scheduleSlots: { orderBy: [{ weekday: "asc" }, { startTime: "asc" }] },
  _count: { select: { sessions: true } }
})

type ClassListRecord = Prisma.ClassGetPayload<{ include: typeof classListInclude }>
type ClassSummaryRecord = Prisma.ClassGetPayload<{ include: typeof classSummaryInclude }>

function toClassListItem(klass: ClassListRecord): ClassListItem {
  return {
    id: klass.id,
    code: klass.code ?? undefined,
    name: klass.name,
    courseId: klass.courseId,
    courseName: klass.course.name,
    subject: klass.course.subject,
    teacherId: klass.teacher.id,
    teacherName: klass.teacher.name,
    weekday: klass.weekday,
    startTime: klass.startTime,
    endTime: klass.endTime,
    room: klass.room ?? undefined,
    startDate: klass.startDate?.toISOString(),
    plannedSessions: klass.plannedSessions ?? undefined,
    isActive: klass.isActive,
    scheduleSlots: klass.scheduleSlots.map((slot) => ({
      id: slot.id,
      weekday: slot.weekday,
      startTime: slot.startTime,
      endTime: slot.endTime,
      room: slot.room ?? undefined,
      isActive: slot.isActive
    })),
    sessionDates: klass.sessions.map((session) => ({
      date: session.date.toISOString(),
      status: session.status
    })),
    students: klass.students.map((classStudent) => ({
      id: classStudent.id,
      studentId: classStudent.studentId,
      studentName: classStudent.student.name,
      parentName: classStudent.student.parent.user.name,
      parentPhone: classStudent.student.parent.user.phone,
      isActive: classStudent.isActive
    })),
    generatedSessionCount: klass._count.sessions
  }
}

function toClassSummaryItem(klass: ClassSummaryRecord): ClassListItem {
  return {
    id: klass.id,
    code: klass.code ?? undefined,
    name: klass.name,
    courseId: klass.courseId,
    courseName: klass.course.name,
    subject: klass.course.subject,
    teacherId: klass.teacher.id,
    teacherName: klass.teacher.name,
    weekday: klass.weekday,
    startTime: klass.startTime,
    endTime: klass.endTime,
    room: klass.room ?? undefined,
    startDate: klass.startDate?.toISOString(),
    plannedSessions: klass.plannedSessions ?? undefined,
    isActive: klass.isActive,
    scheduleSlots: klass.scheduleSlots.map((slot) => ({
      id: slot.id,
      weekday: slot.weekday,
      startTime: slot.startTime,
      endTime: slot.endTime,
      room: slot.room ?? undefined,
      isActive: slot.isActive
    })),
    sessionDates: klass.sessions.map((session) => ({
      date: session.date.toISOString(),
      status: session.status
    })),
    students: [],
    generatedSessionCount: klass._count.sessions
  }
}

export async function GET(request: Request) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "students:view_all") && !can(session.user.role, "students:view_class")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền xem lớp học." }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const parsed = classListQuerySchema.safeParse(Object.fromEntries(searchParams))

  if (!parsed.success) {
    return fail({ code: "INVALID_QUERY", message: "Bộ lọc lớp học không hợp lệ." }, { status: 400 })
  }

  const where = {
    ...(parsed.data.active ? { isActive: parsed.data.active === "true" } : {}),
    ...(session.user.role === "TEACHER" ? { teacherId: session.user.id } : {})
  }
  const orderBy = [{ isActive: "desc" as const }, { weekday: "asc" as const }, { startTime: "asc" as const }]

  if (parsed.data.summary === "true") {
    const classes = await prisma.class.findMany({
      where,
      include: classSummaryInclude,
      orderBy
    })

    return ok(classes.map(toClassSummaryItem))
  }

  const classes = await prisma.class.findMany({
    where,
    include: classListInclude,
    orderBy
  })

  return ok(classes.map(toClassListItem))
}

export async function POST(request: Request) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "courses:manage")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền tạo lớp học." }, { status: 403 })
  }

  const body = await request.json()
  const parsed = classCreateSchema.safeParse(body)

  if (!parsed.success) {
    return fail({ code: "INVALID_BODY", message: "Thông tin lớp học không hợp lệ." }, { status: 400 })
  }

  const data = parsed.data
  const studentIds = [...new Set(data.studentIds)]
  const eligibleStudents = await prisma.student.findMany({
    where: {
      id: { in: studentIds },
      enrollments: { some: { courseId: data.courseId, isActive: true } },
      classStudents: {
        none: {
          isActive: true,
          class: { courseId: data.courseId, isActive: true }
        }
      }
    },
    select: { id: true }
  })

  if (eligibleStudents.length !== studentIds.length) {
    return fail({
      code: "INVALID_CLASS_STUDENTS",
      message: "Chỉ có thể xếp học viên đã ghi danh active đúng khóa và chưa ở lớp active khác của khóa này."
    }, { status: 400 })
  }

  const klass = await prisma.$transaction(async (tx) => {
    const course = await tx.course.findUniqueOrThrow({ where: { id: data.courseId } })
    const slots = normalizeScheduleSlots(data)
    const primarySlot = slots[0]
    const created = await tx.class.create({
      data: {
        name: data.name,
        code: data.code,
        courseId: data.courseId,
        teacherId: data.teacherId,
        weekday: primarySlot.weekday,
        startTime: primarySlot.startTime,
        endTime: primarySlot.endTime,
        room: primarySlot.room,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        plannedSessions: data.plannedSessions ?? course.totalSessions,
        isActive: data.isActive,
        students: {
          create: studentIds.map((studentId) => ({
            studentId
          }))
        }
      }
    })

    await replaceClassSchedule(tx, {
      classId: created.id,
      startDate: data.startDate,
      plannedSessions: data.plannedSessions ?? course.totalSessions,
      slots
    })

    return tx.class.findUniqueOrThrow({
      where: { id: created.id },
      include: classListInclude
    })
  })

  return ok(toClassListItem(klass), { status: 201 })
}
