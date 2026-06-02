import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { createAuditLog, getActiveStaffRecipientIds, notifyUsers } from "@/lib/backend/activity"
import { staffLeaveRequestInclude, toStaffLeaveRequestItem } from "@/lib/backend/staff-leave"
import { prisma } from "@/lib/prisma"
import { staffLeaveUpdateSchema } from "@/lib/validations/staff-leave"

type RouteContext = {
  params: Promise<{ id: string }>
}

const staffRoles = ["ADMIN", "SALE", "TEACHER"] as const

function isStaffRole(role: string) {
  return staffRoles.some((staffRole) => staffRole === role)
}

function canManageStaffLeave(role: string) {
  return role === "ADMIN" || role === "SALE"
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!isStaffRole(session.user.role)) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền xem lịch nghỉ nhân sự." }, { status: 403 })
  }

  const { id } = await context.params
  const request = await prisma.staffLeaveRequest.findUnique({
    where: { id },
    include: staffLeaveRequestInclude
  })

  if (!request) {
    return fail({ code: "STAFF_LEAVE_NOT_FOUND", message: "Không tìm thấy yêu cầu nghỉ." }, { status: 404 })
  }

  if (!canManageStaffLeave(session.user.role) && request.staffId !== session.user.id) {
    return fail({ code: "FORBIDDEN", message: "Bạn chỉ được xem lịch nghỉ của mình." }, { status: 403 })
  }

  return ok(toStaffLeaveRequestItem(request))
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!isStaffRole(session.user.role)) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền cập nhật lịch nghỉ nhân sự." }, { status: 403 })
  }

  const body = await request.json()
  const parsed = staffLeaveUpdateSchema.safeParse(body)

  if (!parsed.success) {
    return fail({ code: "INVALID_BODY", message: "Thông tin cập nhật nghỉ phép không hợp lệ." }, { status: 400 })
  }

  const { id } = await context.params

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.staffLeaveRequest.findUnique({
        where: { id },
        include: staffLeaveRequestInclude
      })

      if (!existing) {
        return null
      }

      const canManage = canManageStaffLeave(session.user.role)

      if (!canManage && existing.staffId !== session.user.id) {
        throw new Error("FORBIDDEN_STAFF_LEAVE")
      }

      if (!canManage && parsed.data.status !== "CANCELED") {
        throw new Error("FORBIDDEN_STAFF_LEAVE_REVIEW")
      }

      const reviewedById = parsed.data.status === "APPROVED" || parsed.data.status === "REJECTED" ? session.user.id : existing.reviewedById
      const reviewedAt = parsed.data.status === "APPROVED" || parsed.data.status === "REJECTED" ? new Date() : existing.reviewedAt

      const leaveRequest = await tx.staffLeaveRequest.update({
        where: { id },
        data: {
          status: parsed.data.status,
          adminNote: parsed.data.adminNote,
          reviewedById,
          reviewedAt
        },
        include: staffLeaveRequestInclude
      })

      await createAuditLog(tx, {
        actorId: session.user.id,
        action: "staff_leave.review",
        entityType: "StaffLeaveRequest",
        entityId: leaveRequest.id,
        summary: `${parsed.data.status} lịch nghỉ của ${existing.staff.name}`,
        metadata: {
          status: parsed.data.status,
          adminNote: parsed.data.adminNote
        }
      })

      await notifyUsers(tx, {
        recipientIds: [existing.staffId, ...(await getActiveStaffRecipientIds(tx, ["ADMIN"]))],
        actorId: session.user.id,
        title: "Lịch nghỉ nhân sự đã cập nhật",
        body: `${existing.staff.name} - ${parsed.data.status}`,
        href: "/classes",
        type: "STAFF_LEAVE"
      })

      return leaveRequest
    })

    if (!updated) {
      return fail({ code: "STAFF_LEAVE_NOT_FOUND", message: "Không tìm thấy yêu cầu nghỉ." }, { status: 404 })
    }

    return ok(toStaffLeaveRequestItem(updated))
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN_STAFF_LEAVE") {
      return fail({ code: "FORBIDDEN", message: "Bạn chỉ được cập nhật lịch nghỉ của mình." }, { status: 403 })
    }

    if (error instanceof Error && error.message === "FORBIDDEN_STAFF_LEAVE_REVIEW") {
      return fail({ code: "FORBIDDEN", message: "Bạn không có quyền duyệt lịch nghỉ nhân sự." }, { status: 403 })
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return fail({ code: "STAFF_LEAVE_NOT_FOUND", message: "Không tìm thấy yêu cầu nghỉ." }, { status: 404 })
    }

    throw error
  }
}
