import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { toMakeupScheduleItem } from "@/lib/backend/makeup-schedule"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "attendance:mark")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền xem lịch học bù." }, { status: 403 })
  }

  const attendances = await prisma.attendance.findMany({
    where: {
      status: "ABSENT_EXCUSED",
      OR: [
        { makeupEntitlement: { is: null } },
        { makeupEntitlement: { is: { status: { in: ["PENDING_SCHEDULE", "SCHEDULED"] } } } }
      ],
      ...(session.user.role === "TEACHER" ? { classSession: { class: { teacherId: session.user.id } } } : {})
    },
    include: {
      enrollment: {
        include: {
          course: true,
          student: {
            include: {
              parent: { include: { user: true } }
            }
          }
        }
      },
      classSession: {
        include: {
          class: {
            include: {
              teacher: true
            }
          }
        }
      },
      markedBy: true
    },
    orderBy: [{ makeupDate: "asc" }, { date: "desc" }]
  })

  return ok(attendances.map(toMakeupScheduleItem))
}
