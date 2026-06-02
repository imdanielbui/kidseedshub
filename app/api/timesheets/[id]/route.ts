import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { createAuditLog } from "@/lib/backend/activity"
import { staffTimesheetEntryInclude, toStaffTimesheetEntryItem } from "@/lib/backend/timesheet"
import { prisma } from "@/lib/prisma"
import { timesheetUpdateSchema } from "@/lib/validations/timesheet"

type RouteContext = {
  params: Promise<{ id: string }>
}

function canManageTimesheets(role: string) {
  return role === "ADMIN"
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!canManageTimesheets(session.user.role)) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền duyệt bảng giờ." }, { status: 403 })
  }

  const body = await request.json()
  const parsed = timesheetUpdateSchema.safeParse(body)

  if (!parsed.success) {
    return fail({ code: "INVALID_BODY", message: "Thông tin cập nhật bảng giờ không hợp lệ." }, { status: 400 })
  }

  const { id } = await context.params

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.staffTimesheetEntry.findUnique({
        where: { id },
        include: {
          staff: {
            select: { name: true }
          }
        }
      })

      if (!existing) {
        return null
      }

      if (existing.status === "APPROVED" && (parsed.data.hours !== undefined || parsed.data.status === "REJECTED")) {
        throw new Error("APPROVED_TIMESHEET_LOCKED")
      }

      const nextStatus = parsed.data.status ?? existing.status
      const hours = parsed.data.hours !== undefined ? new Prisma.Decimal(parsed.data.hours) : existing.hours

      const entry = await tx.staffTimesheetEntry.update({
        where: { id },
        data: {
          status: nextStatus,
          hours,
          note: parsed.data.note ?? existing.note,
          approvedById: nextStatus === "APPROVED" ? session.user.id : null,
          approvedAt: nextStatus === "APPROVED" ? new Date() : null
        },
        include: staffTimesheetEntryInclude
      })

      await createAuditLog(tx, {
        actorId: session.user.id,
        action: "timesheet.review",
        entityType: "StaffTimesheetEntry",
        entityId: entry.id,
        summary: `${nextStatus} bảng giờ của ${existing.staff.name}`,
        metadata: {
          previousStatus: existing.status,
          status: nextStatus,
          previousHours: existing.hours.toString(),
          hours: hours.toString(),
          note: parsed.data.note
        }
      })

      return entry
    })

    if (!updated) {
      return fail({ code: "TIMESHEET_NOT_FOUND", message: "Không tìm thấy bảng giờ." }, { status: 404 })
    }

    return ok(toStaffTimesheetEntryItem(updated))
  } catch (error) {
    if (error instanceof Error && error.message === "APPROVED_TIMESHEET_LOCKED") {
      return fail({ code: "APPROVED_TIMESHEET_LOCKED", message: "Bảng giờ đã duyệt không thể sửa trực tiếp." }, { status: 409 })
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return fail({ code: "TIMESHEET_NOT_FOUND", message: "Không tìm thấy bảng giờ." }, { status: 404 })
    }

    throw error
  }
}
