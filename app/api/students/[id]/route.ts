import { fail, ok } from "@/lib/api-response"
import { isPrismaErrorCode, requireRoutePermission } from "@/lib/backend/api-route"
import { activateParentAccountForStatus } from "@/lib/backend/parent-account"
import { findStudentDetail, studentDetailInclude, toStudentDetail } from "@/lib/modules/students/student-detail"
import { prisma } from "@/lib/prisma"
import { studentUpdateSchema } from "@/lib/validations/student"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const authorization = await requireRoutePermission({
    permissions: ["students:view_all", "students:view_class"],
    forbiddenMessage: "Bạn không có quyền xem học viên."
  })
  if (authorization instanceof Response) return authorization
  const session = authorization

  const { id } = await context.params
  const student = await findStudentDetail(id)

  if (!student) {
    return fail({ code: "NOT_FOUND", message: "Học viên không tồn tại." }, { status: 404 })
  }

  if (session.user.role === "TEACHER" && student.assignedTeacherId !== session.user.id) {
    return fail({ code: "FORBIDDEN", message: "Bạn chỉ được xem học viên mình phụ trách." }, { status: 403 })
  }

  return ok(toStudentDetail(student, session.user.role))
}

export async function PATCH(request: Request, context: RouteContext) {
  const authorization = await requireRoutePermission({
    permissions: ["students:edit"],
    forbiddenMessage: "Bạn không có quyền cập nhật học viên."
  })
  if (authorization instanceof Response) return authorization
  const session = authorization

  const body = await request.json()
  const parsed = studentUpdateSchema.safeParse(body)

  if (!parsed.success) {
    return fail({ code: "INVALID_BODY", message: "Thông tin cập nhật học viên không hợp lệ." }, { status: 400 })
  }

  const { id } = await context.params

  try {
    const student = await prisma.$transaction(async (tx) => {
      const existing = await tx.student.findUnique({
        where: { id },
        include: { parent: true }
      })

      if (!existing) {
        return null
      }

      const statusChanged = parsed.data.status !== undefined && parsed.data.status !== existing.status
      const shouldActivate = parsed.data.status !== undefined && (parsed.data.status === "CONVERTED" || parsed.data.status === "ACTIVE")

      if (parsed.data.parent || shouldActivate) {
        await tx.user.update({
          where: { id: existing.parent.userId },
          data: {
            name: parsed.data.parent?.name,
            phone: parsed.data.parent?.phone,
            email: parsed.data.parent?.email,
            ...(shouldActivate ? { role: "PARENT" as const, isActive: true } : {})
          }
        })
      }

      await activateParentAccountForStatus(tx, existing.parent.userId, parsed.data.status)

      return tx.student.update({
        where: { id },
        data: {
          name: parsed.data.name,
          birthDate: parsed.data.birthDate === undefined ? undefined : parsed.data.birthDate ? new Date(parsed.data.birthDate) : null,
          address: parsed.data.address,
          status: parsed.data.status,
          stageChangedAt: statusChanged ? new Date() : undefined,
          gender: parsed.data.gender,
          leadSource: parsed.data.leadSource,
          leadNote: parsed.data.leadNote,
          healthNote: parsed.data.healthNote,
          saleOwnerId: parsed.data.saleOwnerId,
          assignedTeacherId: parsed.data.assignedTeacherId
        },
        include: studentDetailInclude
      })
    })

    if (!student) {
      return fail({ code: "NOT_FOUND", message: "Học viên không tồn tại." }, { status: 404 })
    }

    return ok(toStudentDetail(student, session.user.role))
  } catch (error) {
    if (isPrismaErrorCode(error, "P2002")) {
      return fail({ code: "DUPLICATE_PARENT", message: "Số điện thoại hoặc email phụ huynh đã tồn tại." }, { status: 409 })
    }

    throw error
  }
}
