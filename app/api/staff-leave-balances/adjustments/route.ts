import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { createAuditLog } from "@/lib/backend/activity"
import {
  staffLeaveBalanceAdjustmentInclude,
  toStaffLeaveBalanceAdjustmentItem
} from "@/lib/backend/staff-leave-balance"
import { prisma } from "@/lib/prisma"
import { staffLeaveBalanceAdjustmentCreateSchema } from "@/lib/validations/staff-leave-balance"

function canAdjustLeaveBalance(role: string) {
  return role === "ADMIN"
}

export async function POST(request: Request) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!canAdjustLeaveBalance(session.user.role)) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền điều chỉnh phép nhân sự." }, { status: 403 })
  }

  const body = await request.json()
  const parsed = staffLeaveBalanceAdjustmentCreateSchema.safeParse(body)

  if (!parsed.success) {
    return fail({ code: "INVALID_BODY", message: "Thông tin điều chỉnh phép không hợp lệ." }, { status: 400 })
  }

  const staffProfile = await prisma.staffProfile.findFirst({
    where: {
      userId: parsed.data.staffId,
      employmentType: "FULL_TIME",
      payrollActive: true,
      user: {
        isActive: true,
        role: { in: ["ADMIN", "SALE", "TEACHER"] }
      }
    },
    include: {
      user: {
        select: {
          name: true
        }
      }
    }
  })

  if (!staffProfile) {
    return fail({ code: "STAFF_PROFILE_NOT_FOUND", message: "Chỉ điều chỉnh phép cho nhân sự toàn thời gian đang hoạt động." }, { status: 404 })
  }

  const days = new Prisma.Decimal(parsed.data.days)

  const adjustment = await prisma.$transaction(async (tx) => {
    const created = await tx.staffLeaveBalanceAdjustment.create({
      data: {
        staffId: parsed.data.staffId,
        days,
        reason: parsed.data.reason,
        createdById: session.user.id
      },
      include: staffLeaveBalanceAdjustmentInclude
    })

    await createAuditLog(tx, {
      actorId: session.user.id,
      action: "staff_leave_balance.adjust",
      entityType: "StaffLeaveBalanceAdjustment",
      entityId: created.id,
      summary: `Điều chỉnh ${days.toString()} ngày phép cho ${staffProfile.user.name}`,
      metadata: {
        staffId: parsed.data.staffId,
        days: days.toString(),
        reason: parsed.data.reason
      }
    })

    return created
  })

  return ok(toStaffLeaveBalanceAdjustmentItem(adjustment), { status: 201 })
}
