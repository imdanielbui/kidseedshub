import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { createAuditLog, getActiveStaffRecipientIds, notifyUsers } from "@/lib/backend/activity"
import { dateKey, rescheduleSessionsOnBlockedDate } from "@/lib/backend/class-schedule"
import type { ScheduleEventItem } from "@/lib/contracts/schedule-events"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { scheduleEventUpdateSchema } from "@/lib/validations/schedule-event"

type RouteContext = {
  params: Promise<{ id: string }>
}

function parseLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year, month - 1, day)
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

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "courses:manage")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền cập nhật lịch nghỉ." }, { status: 403 })
  }

  const body = await request.json()
  const parsed = scheduleEventUpdateSchema.safeParse(body)

  if (!parsed.success) {
    return fail({ code: "INVALID_BODY", message: "Thông tin lịch nghỉ không hợp lệ." }, { status: 400 })
  }

  const { id } = await context.params

  try {
    const result = await prisma.$transaction(async (tx) => {
      const event = await tx.scheduleEvent.update({
        where: { id },
        data: {
          title: parsed.data.title,
          date: parsed.data.date ? parseLocalDate(parsed.data.date) : undefined,
          type: parsed.data.type,
          affectsScheduling: parsed.data.affectsScheduling,
          note: parsed.data.note
        }
      })
      const movedSessions = event.affectsScheduling ? await rescheduleSessionsOnBlockedDate(tx, event.date) : 0

      await createAuditLog(tx, {
        actorId: session.user.id,
        action: "schedule_event.update",
        entityType: "ScheduleEvent",
        entityId: event.id,
        summary: `Cập nhật lịch nghỉ/sự kiện ${event.title}`,
        metadata: {
          date: dateKey(event.date),
          affectsScheduling: event.affectsScheduling,
          movedSessions
        }
      })

      await notifyUsers(tx, {
        recipientIds: await getActiveStaffRecipientIds(tx, ["ADMIN", "SALE", "TEACHER"]),
        actorId: session.user.id,
        title: "Lịch nghỉ/sự kiện được cập nhật",
        body: `${event.title} - ${dateKey(event.date)}${movedSessions ? `, dời ${movedSessions} buổi` : ""}`,
        href: "/classes",
        type: "SCHEDULE_EVENT"
      })

      return {
        event,
        movedSessions
      }
    })

    return ok({ ...toScheduleEventItem(result.event), movedSessions: result.movedSessions })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return fail({ code: "EVENT_NOT_FOUND", message: "Không tìm thấy lịch nghỉ." }, { status: 404 })
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return fail({ code: "DUPLICATE_EVENT", message: "Ngày nghỉ/sự kiện đã tồn tại." }, { status: 409 })
    }

    throw error
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "courses:manage")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền xóa lịch nghỉ." }, { status: 403 })
  }

  const { id } = await context.params

  try {
    await prisma.$transaction(async (tx) => {
      const event = await tx.scheduleEvent.delete({ where: { id } })

      await createAuditLog(tx, {
        actorId: session.user.id,
        action: "schedule_event.delete",
        entityType: "ScheduleEvent",
        entityId: event.id,
        summary: `Xóa lịch nghỉ/sự kiện ${event.title}`,
        metadata: {
          date: dateKey(event.date)
        }
      })

      await notifyUsers(tx, {
        recipientIds: await getActiveStaffRecipientIds(tx, ["ADMIN", "SALE", "TEACHER"]),
        actorId: session.user.id,
        title: "Lịch nghỉ/sự kiện đã xóa",
        body: `${event.title} - ${dateKey(event.date)}`,
        href: "/classes",
        type: "SCHEDULE_EVENT"
      })
    })

    return ok({ deleted: true })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return fail({ code: "EVENT_NOT_FOUND", message: "Không tìm thấy lịch nghỉ." }, { status: 404 })
    }

    throw error
  }
}
