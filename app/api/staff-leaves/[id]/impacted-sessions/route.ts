import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { toStaffLeaveImpactedSessionItem } from "@/lib/backend/staff-leave"
import { prisma } from "@/lib/prisma"

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
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền xem lớp bị ảnh hưởng." }, { status: 403 })
  }

  const { id } = await context.params
  const leaveRequest = await prisma.staffLeaveRequest.findUnique({
    where: { id },
    select: {
      id: true,
      staffId: true,
      startDate: true,
      endDate: true
    }
  })

  if (!leaveRequest) {
    return fail({ code: "STAFF_LEAVE_NOT_FOUND", message: "Không tìm thấy yêu cầu nghỉ." }, { status: 404 })
  }

  if (!canManageStaffLeave(session.user.role) && leaveRequest.staffId !== session.user.id) {
    return fail({ code: "FORBIDDEN", message: "Bạn chỉ được xem lịch nghỉ của mình." }, { status: 403 })
  }

  const sessions = await prisma.classSession.findMany({
    where: {
      date: {
        gte: leaveRequest.startDate,
        lte: new Date(new Date(leaveRequest.endDate).setUTCHours(23, 59, 59, 999))
      },
      OR: [
        { class: { teacherId: leaveRequest.staffId } },
        { substituteTeacherId: leaveRequest.staffId }
      ]
    },
    include: {
      substituteTeacher: true,
      class: {
        include: {
          teacher: true,
          course: true
        }
      }
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }]
  })

  return ok(sessions.map((classSession) => toStaffLeaveImpactedSessionItem(classSession, leaveRequest.staffId)))
}
