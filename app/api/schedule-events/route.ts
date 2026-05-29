import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { createAuditLog, getActiveStaffRecipientIds, notifyUsers } from "@/lib/backend/activity"
import { dateKey, rescheduleSessionsOnBlockedDate } from "@/lib/backend/class-schedule"
import type { ScheduleEventItem } from "@/lib/contracts/schedule-events"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { scheduleEventCreateSchema, scheduleEventListQuerySchema } from "@/lib/validations/schedule-event"

function parseLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year, month - 1, day)
}

function monthRange(month?: string) {
  const now = new Date()
  const [year, monthIndex] = month ? month.split("-").map(Number) : [now.getFullYear(), now.getMonth() + 1]
  const start = new Date(year, monthIndex - 1, 1)
  const end = new Date(year, monthIndex, 0, 23, 59, 59, 999)
  return { start, end }
}

function toScheduleEventItem(event: {
  id: string
  title: string
  date: Date
  type: ScheduleEventItem["type"]
  affectsScheduling: boolean
  note: string | null
}): ScheduleEventItem {
  return {
    id: event.id,
    title: event.title,
    date: dateKey(event.date),
    type: event.type,
    affectsScheduling: event.affectsScheduling,
    note: event.note ?? undefined
  }
}

export async function GET(request: Request) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "students:view_all") && !can(session.user.role, "students:view_class")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền xem lịch nghỉ." }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const parsed = scheduleEventListQuerySchema.safeParse(Object.fromEntries(searchParams))

  if (!parsed.success) {
    return fail({ code: "INVALID_QUERY", message: "Bộ lọc lịch nghỉ không hợp lệ." }, { status: 400 })
  }

  const range = monthRange(parsed.data.month)
  const events = await prisma.scheduleEvent.findMany({
    where: {
      date: {
        gte: range.start,
        lte: range.end
      }
    },
    orderBy: [{ date: "asc" }, { title: "asc" }]
  })

  return ok(events.map(toScheduleEventItem))
}

export async function POST(request: Request) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "courses:manage")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền tạo lịch nghỉ." }, { status: 403 })
  }

  const body = await request.json()
  const parsed = scheduleEventCreateSchema.safeParse(body)

  if (!parsed.success) {
    return fail({ code: "INVALID_BODY", message: "Thông tin lịch nghỉ không hợp lệ." }, { status: 400 })
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const event = await tx.scheduleEvent.create({
        data: {
          title: parsed.data.title,
          date: parseLocalDate(parsed.data.date),
          type: parsed.data.type,
          affectsScheduling: parsed.data.affectsScheduling,
          note: parsed.data.note
        }
      })
      const movedSessions = event.affectsScheduling ? await rescheduleSessionsOnBlockedDate(tx, event.date) : 0

      await createAuditLog(tx, {
        actorId: session.user.id,
        action: "schedule_event.create",
        entityType: "ScheduleEvent",
        entityId: event.id,
        summary: `Tạo lịch nghỉ/sự kiện ${event.title}`,
        metadata: {
          date: dateKey(event.date),
          affectsScheduling: event.affectsScheduling,
          movedSessions
        }
      })

      await notifyUsers(tx, {
        recipientIds: await getActiveStaffRecipientIds(tx, ["ADMIN", "SALE", "TEACHER"]),
        actorId: session.user.id,
        title: "Lịch nghỉ/sự kiện mới",
        body: `${event.title} - ${dateKey(event.date)}${movedSessions ? `, dời ${movedSessions} buổi` : ""}`,
        href: "/classes",
        type: "SCHEDULE_EVENT"
      })

      return {
        event,
        movedSessions
      }
    })

    return ok({ ...toScheduleEventItem(result.event), movedSessions: result.movedSessions }, { status: 201 })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return fail({ code: "DUPLICATE_EVENT", message: "Ngày nghỉ/sự kiện đã tồn tại." }, { status: 409 })
    }

    throw error
  }
}
