import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { createAuditLog } from "@/lib/backend/activity"
import { staffTimesheetEntryInclude, toStaffTimesheetEntryItem } from "@/lib/backend/timesheet"
import { prisma } from "@/lib/prisma"
import { timesheetCreateSchema, timesheetListQuerySchema } from "@/lib/validations/timesheet"

function canManageTimesheets(role: string) {
  return role === "ADMIN"
}

function canViewOwnTimesheet(role: string) {
  return role === "TEACHER"
}

function parseDateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`)
}

function monthRange(month: string) {
  const [year, monthIndex] = month.split("-").map(Number)
  const start = new Date(Date.UTC(year, monthIndex - 1, 1))
  const end = new Date(Date.UTC(year, monthIndex, 0, 23, 59, 59, 999))

  return { start, end }
}

export async function GET(request: Request) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!canManageTimesheets(session.user.role) && !canViewOwnTimesheet(session.user.role)) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền xem bảng giờ." }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const parsed = timesheetListQuerySchema.safeParse(Object.fromEntries(searchParams))

  if (!parsed.success) {
    return fail({ code: "INVALID_QUERY", message: "Bộ lọc bảng giờ không hợp lệ." }, { status: 400 })
  }

  const range = monthRange(parsed.data.month ?? new Date().toISOString().slice(0, 7))
  const staffId = canManageTimesheets(session.user.role) ? parsed.data.staffId : session.user.id

  const entries = await prisma.staffTimesheetEntry.findMany({
    where: {
      date: {
        gte: range.start,
        lte: range.end
      },
      ...(staffId ? { staffId } : {}),
      ...(parsed.data.status ? { status: parsed.data.status } : {})
    },
    include: staffTimesheetEntryInclude,
    orderBy: [{ date: "asc" }, { startTime: "asc" }, { createdAt: "asc" }]
  })

  return ok(entries.map(toStaffTimesheetEntryItem))
}

export async function POST(request: Request) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!canManageTimesheets(session.user.role)) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền tạo bảng giờ thủ công." }, { status: 403 })
  }

  const body = await request.json()
  const parsed = timesheetCreateSchema.safeParse(body)

  if (!parsed.success) {
    return fail({ code: "INVALID_BODY", message: "Thông tin bảng giờ không hợp lệ." }, { status: 400 })
  }

  const staff = await prisma.user.findFirst({
    where: {
      id: parsed.data.staffId,
      isActive: true,
      role: { in: ["ADMIN", "SALE", "TEACHER"] }
    },
    select: { id: true, name: true }
  })

  if (!staff) {
    return fail({ code: "STAFF_NOT_FOUND", message: "Không tìm thấy nhân sự đang hoạt động." }, { status: 404 })
  }

  const hours = new Prisma.Decimal(parsed.data.hours)

  const entry = await prisma.$transaction(async (tx) => {
    const created = await tx.staffTimesheetEntry.create({
      data: {
        staffId: parsed.data.staffId,
        date: parseDateOnly(parsed.data.date),
        source: parsed.data.source,
        startTime: parsed.data.startTime,
        endTime: parsed.data.endTime,
        hours,
        note: parsed.data.note
      },
      include: staffTimesheetEntryInclude
    })

    await createAuditLog(tx, {
      actorId: session.user.id,
      action: "timesheet.create",
      entityType: "StaffTimesheetEntry",
      entityId: created.id,
      summary: `Tạo bảng giờ ${hours.toString()}h cho ${staff.name}`,
      metadata: {
        staffId: staff.id,
        source: parsed.data.source,
        date: parsed.data.date,
        hours: hours.toString()
      }
    })

    return created
  })

  return ok(toStaffTimesheetEntryItem(entry), { status: 201 })
}
