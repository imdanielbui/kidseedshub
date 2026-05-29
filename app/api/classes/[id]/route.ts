import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { normalizeScheduleSlots, replaceClassSchedule } from "@/lib/backend/class-schedule"
import type { ClassListItem } from "@/lib/contracts/courses"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { classUpdateSchema } from "@/lib/validations/course"

type RouteContext = {
  params: Promise<{ id: string }>
}

const classListInclude = Prisma.validator<Prisma.ClassInclude>()({
  course: true,
  teacher: true,
  scheduleSlots: { orderBy: [{ weekday: "asc" }, { startTime: "asc" }] },
  students: { include: { student: { include: { parent: { include: { user: true } } } } } },
  _count: { select: { sessions: true } }
})

type ClassListRecord = Prisma.ClassGetPayload<{ include: typeof classListInclude }>

function toClassListItem(klass: ClassListRecord): ClassListItem {
  return {
    id: klass.id,
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

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "courses:manage")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền cập nhật lịch lớp." }, { status: 403 })
  }

  const body = await request.json()
  const parsed = classUpdateSchema.safeParse(body)

  if (!parsed.success) {
    return fail({ code: "INVALID_BODY", message: "Thông tin lịch lớp không hợp lệ." }, { status: 400 })
  }

  const { id } = await context.params

  try {
    const klass = await prisma.$transaction(async (tx) => {
      const existing = await tx.class.findUniqueOrThrow({
        where: { id },
        include: {
          course: true,
          scheduleSlots: { orderBy: [{ weekday: "asc" }, { startTime: "asc" }] }
        }
      })
      const slots =
        parsed.data.scheduleSlots || parsed.data.weekday !== undefined || parsed.data.startTime !== undefined || parsed.data.endTime !== undefined || parsed.data.room !== undefined
          ? normalizeScheduleSlots({
              scheduleSlots: parsed.data.scheduleSlots,
              weekday: parsed.data.weekday ?? existing.weekday,
              startTime: parsed.data.startTime ?? existing.startTime,
              endTime: parsed.data.endTime ?? existing.endTime,
              room: parsed.data.room ?? existing.room ?? undefined
            })
          : existing.scheduleSlots.map((slot) => ({
              weekday: slot.weekday,
              startTime: slot.startTime,
              endTime: slot.endTime,
              room: slot.room ?? undefined,
              isActive: slot.isActive
            }))
      const primarySlot = slots[0] ?? {
        weekday: existing.weekday,
        startTime: existing.startTime,
        endTime: existing.endTime,
        room: existing.room ?? undefined
      }
      const plannedSessions = parsed.data.plannedSessions ?? existing.plannedSessions ?? existing.course.totalSessions

      await tx.class.update({
        where: { id },
        data: {
          name: parsed.data.name,
          courseId: parsed.data.courseId,
          teacherId: parsed.data.teacherId,
          weekday: primarySlot.weekday,
          startTime: primarySlot.startTime,
          endTime: primarySlot.endTime,
          room: primarySlot.room,
          startDate: parsed.data.startDate === undefined ? undefined : new Date(parsed.data.startDate),
          plannedSessions,
          isActive: parsed.data.isActive
        }
      })

      if (
        parsed.data.scheduleSlots ||
        parsed.data.weekday !== undefined ||
        parsed.data.startTime !== undefined ||
        parsed.data.endTime !== undefined ||
        parsed.data.room !== undefined ||
        parsed.data.startDate !== undefined ||
        parsed.data.plannedSessions !== undefined
      ) {
        const startDate = parsed.data.startDate ?? existing.startDate?.toISOString().slice(0, 10)
        await replaceClassSchedule(tx, {
          classId: id,
          startDate,
          plannedSessions,
          slots
        })
      }

      return tx.class.findUniqueOrThrow({
        where: { id },
        include: classListInclude
      })
    })

    return ok(toClassListItem(klass))
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return fail({ code: "CLASS_NOT_FOUND", message: "Không tìm thấy lớp học." }, { status: 404 })
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return fail({ code: "CLASS_RELATION_NOT_FOUND", message: "Khóa học hoặc giáo viên không tồn tại." }, { status: 400 })
    }

    throw error
  }
}
