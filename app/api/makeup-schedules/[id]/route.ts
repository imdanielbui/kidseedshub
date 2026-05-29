import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { toMakeupScheduleItem } from "@/lib/backend/makeup-schedule"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { makeupScheduleUpdateSchema } from "@/lib/validations/attendance"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "attendance:mark")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền cập nhật lịch học bù." }, { status: 403 })
  }

  const body = await request.json()
  const parsed = makeupScheduleUpdateSchema.safeParse(body)

  if (!parsed.success) {
    return fail({ code: "INVALID_BODY", message: "Ngày học bù không hợp lệ." }, { status: 400 })
  }

  const { id } = await context.params

  try {
    const existing = await prisma.attendance.findUnique({
      where: { id },
      include: {
        classSession: { include: { class: true } }
      }
    })

    if (!existing || existing.status !== "ABSENT_EXCUSED") {
      return fail({ code: "MAKEUP_ATTENDANCE_NOT_FOUND", message: "Không tìm thấy buổi nghỉ phép cần xếp học bù." }, { status: 404 })
    }

    if (session.user.role === "TEACHER" && existing.classSession?.class.teacherId !== session.user.id) {
      return fail({ code: "FORBIDDEN", message: "Giáo viên chỉ được cập nhật lớp mình phụ trách." }, { status: 403 })
    }

    const updated = await prisma.attendance.update({
      where: { id },
      data: {
        makeupDate: parsed.data.makeupDate ? new Date(parsed.data.makeupDate) : null,
        markedById: session.user.id
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
      }
    })

    return ok(toMakeupScheduleItem(updated))
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return fail({ code: "MAKEUP_ATTENDANCE_NOT_FOUND", message: "Không tìm thấy buổi nghỉ phép cần xếp học bù." }, { status: 404 })
    }

    throw error
  }
}
