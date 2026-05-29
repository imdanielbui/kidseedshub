import { z } from "zod"
import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { createAuditLog, getActiveStaffRecipientIds, notifyUsers } from "@/lib/backend/activity"
import { dateKey } from "@/lib/backend/class-schedule"
import { ensureVietnamPublicHolidays } from "@/lib/backend/vietnam-public-holidays"
import type { ScheduleEventItem } from "@/lib/contracts/schedule-events"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

const vietnamHolidayImportSchema = z.object({
  year: z.number().int().min(2026).max(2035).optional()
})

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

export async function POST(request: Request) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "courses:manage")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền nạp ngày lễ/sự kiện." }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const parsed = vietnamHolidayImportSchema.safeParse(body)

  if (!parsed.success) {
    return fail({ code: "INVALID_BODY", message: "Năm nạp lịch ngày lễ/sự kiện không hợp lệ." }, { status: 400 })
  }

  const year = parsed.data.year ?? new Date().getFullYear()

  const result = await prisma.$transaction(async (tx) => {
    const importResult = await ensureVietnamPublicHolidays(tx, year)

    await createAuditLog(tx, {
      actorId: session.user.id,
      action: "schedule_event.import_vietnam_holidays",
      entityType: "ScheduleEvent",
      entityId: `vietnam-holidays-${year}`,
      summary: `Nạp ngày lễ/sự kiện Việt Nam năm ${year}`,
      metadata: {
        year,
        created: importResult.created,
        skipped: importResult.skipped,
        movedSessions: importResult.movedSessions
      }
    })

    if (importResult.created || importResult.movedSessions) {
      await notifyUsers(tx, {
        recipientIds: await getActiveStaffRecipientIds(tx, ["ADMIN", "SALE", "TEACHER"]),
        actorId: session.user.id,
        title: "Đã nạp lịch ngày lễ/sự kiện Việt Nam",
        body: `${year}: thêm ${importResult.created} ngày, dời ${importResult.movedSessions} buổi học.`,
        href: "/classes",
        type: "SCHEDULE_EVENT"
      })
    }

    return importResult
  })

  return ok({
    year: result.year,
    created: result.created,
    skipped: result.skipped,
    movedSessions: result.movedSessions,
    events: result.events.map(toScheduleEventItem)
  })
}
