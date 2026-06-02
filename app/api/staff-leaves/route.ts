import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { createAuditLog, getActiveStaffRecipientIds, notifyUsers } from "@/lib/backend/activity"
import { staffLeaveRequestInclude, toStaffLeaveRequestItem } from "@/lib/backend/staff-leave"
import { prisma } from "@/lib/prisma"
import { staffLeaveCreateSchema, staffLeaveListQuerySchema } from "@/lib/validations/staff-leave"

const staffRoles = ["ADMIN", "SALE", "TEACHER"] as const

function isStaffRole(role: string) {
  return staffRoles.some((staffRole) => staffRole === role)
}

function canManageStaffLeave(role: string) {
  return role === "ADMIN" || role === "SALE"
}

function parseDateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`)
}

export async function GET(request: Request) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!isStaffRole(session.user.role)) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền xem lịch nghỉ nhân sự." }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const parsed = staffLeaveListQuerySchema.safeParse(Object.fromEntries(searchParams))

  if (!parsed.success) {
    return fail({ code: "INVALID_QUERY", message: "Bộ lọc lịch nghỉ không hợp lệ." }, { status: 400 })
  }

  const requests = await prisma.staffLeaveRequest.findMany({
    where: {
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
      ...(canManageStaffLeave(session.user.role)
        ? parsed.data.staffId ? { staffId: parsed.data.staffId } : {}
        : { staffId: session.user.id })
    },
    include: staffLeaveRequestInclude,
    orderBy: [{ status: "asc" }, { startDate: "asc" }, { createdAt: "desc" }]
  })

  return ok(requests.map(toStaffLeaveRequestItem))
}

export async function POST(request: Request) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!isStaffRole(session.user.role)) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền tạo lịch nghỉ nhân sự." }, { status: 403 })
  }

  const body = await request.json()
  const parsed = staffLeaveCreateSchema.safeParse(body)

  if (!parsed.success) {
    return fail({ code: "INVALID_BODY", message: "Thông tin nghỉ phép không hợp lệ." }, { status: 400 })
  }

  const staffId = canManageStaffLeave(session.user.role) ? parsed.data.staffId ?? session.user.id : session.user.id
  const startDate = parseDateOnly(parsed.data.startDate)
  const endDate = parseDateOnly(parsed.data.endDate)

  if (endDate < startDate) {
    return fail({ code: "INVALID_DATE_RANGE", message: "Ngày kết thúc phải sau hoặc bằng ngày bắt đầu." }, { status: 400 })
  }

  const staff = await prisma.user.findFirst({
    where: {
      id: staffId,
      role: { in: [...staffRoles] },
      isActive: true
    },
    select: { id: true, name: true, role: true }
  })

  if (!staff) {
    return fail({ code: "STAFF_NOT_FOUND", message: "Không tìm thấy nhân sự đang hoạt động." }, { status: 404 })
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const leaveRequest = await tx.staffLeaveRequest.create({
        data: {
          staffId,
          startDate,
          endDate,
          type: parsed.data.type,
          reason: parsed.data.reason
        },
        include: staffLeaveRequestInclude
      })

      await createAuditLog(tx, {
        actorId: session.user.id,
        action: "staff_leave.create",
        entityType: "StaffLeaveRequest",
        entityId: leaveRequest.id,
        summary: `Tạo yêu cầu nghỉ cho ${staff.name}`,
        metadata: {
          staffId,
          startDate: parsed.data.startDate,
          endDate: parsed.data.endDate,
          type: parsed.data.type
        }
      })

      await notifyUsers(tx, {
        recipientIds: await getActiveStaffRecipientIds(tx, ["ADMIN"]),
        actorId: session.user.id,
        title: "Có yêu cầu nghỉ nhân sự",
        body: `${staff.name} - ${parsed.data.startDate} đến ${parsed.data.endDate}`,
        href: "/classes",
        type: "STAFF_LEAVE"
      })

      return leaveRequest
    })

    return ok(toStaffLeaveRequestItem(created), { status: 201 })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return fail({ code: "STAFF_NOT_FOUND", message: "Không tìm thấy nhân sự để tạo lịch nghỉ." }, { status: 404 })
    }

    throw error
  }
}
