import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { absenceRequestInclude, toAbsenceRequestItem } from "@/lib/backend/absence-request"
import { createAuditLog, getActiveStaffRecipientIds, notifyUsers } from "@/lib/backend/activity"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { absenceRequestCreateSchema, absenceRequestListQuerySchema } from "@/lib/validations/absence-request"

export async function GET(request: Request) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const parsed = absenceRequestListQuerySchema.safeParse(Object.fromEntries(searchParams))

  if (!parsed.success) {
    return fail({ code: "INVALID_QUERY", message: "Bộ lọc xin nghỉ không hợp lệ." }, { status: 400 })
  }

  const statusFilter = parsed.data.status ? { status: parsed.data.status } : {}

  if (can(session.user.role, "portal:request_absence")) {
    const requests = await prisma.absenceRequest.findMany({
      where: {
        ...statusFilter,
        parent: { userId: session.user.id }
      },
      include: absenceRequestInclude,
      orderBy: { createdAt: "desc" }
    })

    return ok(requests.map(toAbsenceRequestItem))
  }

  if (!can(session.user.role, "attendance:mark")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền xem yêu cầu xin nghỉ." }, { status: 403 })
  }

  const requests = await prisma.absenceRequest.findMany({
    where: {
      ...statusFilter,
      ...(session.user.role === "TEACHER" ? { classSession: { class: { teacherId: session.user.id } } } : {})
    },
    include: absenceRequestInclude,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }]
  })

  return ok(requests.map(toAbsenceRequestItem))
}

export async function POST(request: Request) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "portal:request_absence")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền gửi xin nghỉ." }, { status: 403 })
  }

  const body = await request.json()
  const parsed = absenceRequestCreateSchema.safeParse(body)

  if (!parsed.success) {
    return fail({ code: "INVALID_BODY", message: "Thông tin xin nghỉ không hợp lệ." }, { status: 400 })
  }

  const parent = await prisma.parent.findUnique({
    where: { userId: session.user.id },
    include: { students: true }
  })

  if (!parent || !parent.students.some((student) => student.id === parsed.data.studentId)) {
    return fail({ code: "FORBIDDEN_CHILD", message: "Bạn chỉ được gửi xin nghỉ cho học viên của mình." }, { status: 403 })
  }

  const classSession = await prisma.classSession.findFirst({
    where: {
      id: parsed.data.classSessionId,
      status: "SCHEDULED",
      class: {
        students: {
          some: {
            studentId: parsed.data.studentId,
            isActive: true
          }
        }
      }
    },
    include: {
      class: {
        select: {
          id: true,
          name: true,
          teacherId: true
        }
      }
    }
  })

  if (!classSession) {
    return fail({ code: "SESSION_NOT_FOUND", message: "Không tìm thấy buổi học hợp lệ để xin nghỉ." }, { status: 404 })
  }

  try {
    const absenceRequest = await prisma.$transaction(async (tx) => {
      const created = await tx.absenceRequest.create({
        data: {
          studentId: parsed.data.studentId,
          parentId: parent.id,
          classSessionId: parsed.data.classSessionId,
          reason: parsed.data.reason
        },
        include: absenceRequestInclude
      })

      await createAuditLog(tx, {
        actorId: session.user.id,
        action: "absence_request.create",
        entityType: "AbsenceRequest",
        entityId: created.id,
        summary: `Phụ huynh gửi xin nghỉ cho ${created.student.name}`,
        metadata: {
          studentId: parsed.data.studentId,
          classSessionId: parsed.data.classSessionId,
          classId: classSession.class.id
        }
      })

      await notifyUsers(tx, {
        recipientIds: [...(await getActiveStaffRecipientIds(tx, ["ADMIN", "SALE"])), classSession.class.teacherId],
        actorId: session.user.id,
        title: "Có yêu cầu xin nghỉ mới",
        body: `${created.student.name} - ${classSession.class.name}`,
        href: "/classes",
        type: "ABSENCE_REQUEST"
      })

      return created
    })

    return ok(toAbsenceRequestItem(absenceRequest), { status: 201 })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return fail({ code: "DUPLICATE_ABSENCE_REQUEST", message: "Buổi học này đã có yêu cầu xin nghỉ." }, { status: 409 })
    }

    throw error
  }
}
