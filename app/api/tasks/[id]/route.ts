import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { taskInclude, toTaskItem } from "@/lib/backend/task-mapper"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { taskUpdateSchema } from "@/lib/validations/crm"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "tasks:manage")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền cập nhật task." }, { status: 403 })
  }

  const body = await request.json()
  const parsed = taskUpdateSchema.safeParse(body)

  if (!parsed.success) {
    return fail({ code: "INVALID_BODY", message: "Thông tin cập nhật task không hợp lệ." }, { status: 400 })
  }

  const { id } = await context.params
  const task = await prisma.task.update({
    where: { id },
    data: {
      title: parsed.data.title,
      note: parsed.data.note,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined,
      status: parsed.data.status,
      assignedToId: parsed.data.assignedToId,
      completedAt: parsed.data.status === "DONE" ? new Date() : undefined
    },
    include: taskInclude
  })

  return ok(toTaskItem(task))
}
