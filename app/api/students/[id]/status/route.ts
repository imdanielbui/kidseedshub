import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { activateParentAccountForStatus } from "@/lib/backend/parent-account"
import type { StudentStatusUpdateResult } from "@/lib/contracts/students"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { studentStatusUpdateSchema } from "@/lib/validations/crm"

type RouteContext = {
  params: Promise<{ id: string }>
}

const studentStatusInclude = Prisma.validator<Prisma.StudentInclude>()({
  parent: { include: { user: true } },
  assignedTeacher: true
})

type StudentStatusRecord = Prisma.StudentGetPayload<{ include: typeof studentStatusInclude }>

function toStudentStatusUpdateResult(student: StudentStatusRecord): StudentStatusUpdateResult {
  return {
    id: student.id,
    code: student.code,
    name: student.name,
    status: student.status,
    stageChangedAt: student.stageChangedAt.toISOString(),
    parentName: student.parent.user.name,
    parentPhone: student.parent.user.phone,
    assignedTeacherName: student.assignedTeacher?.name,
    updatedAt: student.updatedAt.toISOString()
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "pipeline:manage")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền cập nhật pipeline." }, { status: 403 })
  }

  const body = await request.json()
  const parsed = studentStatusUpdateSchema.safeParse(body)

  if (!parsed.success) {
    return fail({ code: "INVALID_BODY", message: "Trạng thái học viên không hợp lệ." }, { status: 400 })
  }

  const { id } = await context.params
  const student = await prisma.$transaction(async (tx) => {
    const updated = await tx.student.update({
      where: { id },
      data: { status: parsed.data.status, stageChangedAt: new Date() },
      include: studentStatusInclude
    })

    await activateParentAccountForStatus(tx, updated.parent.userId, parsed.data.status)

    return updated
  })

  return ok(toStudentStatusUpdateResult(student))
}
