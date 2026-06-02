import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { calculateStaffLeaveBalance } from "@/lib/backend/staff-leave-balance"
import { prisma } from "@/lib/prisma"
import { staffLeaveBalanceListQuerySchema } from "@/lib/validations/staff-leave-balance"

const staffRoles = ["ADMIN", "SALE", "TEACHER"] as const

function isStaffRole(role: string) {
  return staffRoles.some((staffRole) => staffRole === role)
}

function canViewAllLeaveBalances(role: string) {
  return role === "ADMIN"
}

function parseDateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`)
}

function endOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999))
}

export async function GET(request: Request) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!isStaffRole(session.user.role)) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền xem phép nhân sự." }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const parsed = staffLeaveBalanceListQuerySchema.safeParse(Object.fromEntries(searchParams))

  if (!parsed.success) {
    return fail({ code: "INVALID_QUERY", message: "Bộ lọc phép nhân sự không hợp lệ." }, { status: 400 })
  }

  const requestedStaffId = canViewAllLeaveBalances(session.user.role) ? parsed.data.staffId : session.user.id
  const asOfDate = parsed.data.asOfDate ? parseDateOnly(parsed.data.asOfDate) : parseDateOnly(new Date().toISOString().slice(0, 10))
  const asOfEnd = endOfUtcDay(asOfDate)

  const profiles = await prisma.staffProfile.findMany({
    where: {
      payrollActive: true,
      ...(requestedStaffId ? { userId: requestedStaffId } : {}),
      user: {
        isActive: true,
        role: { in: [...staffRoles] }
      }
    },
    include: {
      user: {
        select: {
          name: true,
          role: true
        }
      }
    },
    orderBy: [{ employmentType: "asc" }, { user: { name: "asc" } }]
  })

  const staffIds = profiles.map((profile) => profile.userId)

  if (!staffIds.length) {
    return ok([])
  }

  const [approvedLeaves, adjustments] = await Promise.all([
    prisma.staffLeaveRequest.findMany({
      where: {
        staffId: { in: staffIds },
        status: "APPROVED",
        type: { in: ["PAID", "UNPAID"] },
        endDate: { lte: asOfEnd }
      },
      select: {
        staffId: true,
        startDate: true,
        endDate: true,
        type: true
      }
    }),
    prisma.staffLeaveBalanceAdjustment.findMany({
      where: {
        staffId: { in: staffIds },
        createdAt: { lte: asOfEnd }
      },
      select: {
        staffId: true,
        days: true
      }
    })
  ])

  return ok(profiles.map((profile) => calculateStaffLeaveBalance({
    profile,
    approvedLeaves: approvedLeaves.filter((leave) => leave.staffId === profile.userId),
    adjustments: adjustments.filter((adjustment) => adjustment.staffId === profile.userId),
    asOfDate
  })))
}
