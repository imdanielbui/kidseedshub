import type { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { taskInclude, toTaskItem } from "@/lib/backend/task-mapper"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { taskCreateSchema, taskListQuerySchema } from "@/lib/validations/crm"

export async function GET(request: Request) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "tasks:manage")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền xem task." }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const parsed = taskListQuerySchema.safeParse(Object.fromEntries(searchParams))

  if (!parsed.success) {
    return fail({ code: "INVALID_QUERY", message: "Bộ lọc task không hợp lệ." }, { status: 400 })
  }

  const { assignedTo, status, page, limit } = parsed.data
  const where: Prisma.TaskWhereInput = {
    ...(assignedTo === "me" ? { assignedToId: session.user.id } : {}),
    ...(status ? { status } : {})
  }

  const [tasks, total] = await prisma.$transaction([
    prisma.task.findMany({
      where,
      include: taskInclude,
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.task.count({ where })
  ])

  return ok(tasks.map(toTaskItem), {
    headers: {
      "x-total-count": String(total)
    }
  })
}

export async function POST(request: Request) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "tasks:manage")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền tạo task." }, { status: 403 })
  }

  const body = await request.json()
  const parsed = taskCreateSchema.safeParse(body)

  if (!parsed.success) {
    return fail({ code: "INVALID_BODY", message: "Thông tin task không hợp lệ." }, { status: 400 })
  }

  const task = await prisma.task.create({
    data: {
      title: parsed.data.title,
      note: parsed.data.note,
      dueDate: new Date(parsed.data.dueDate),
      studentId: parsed.data.studentId,
      assignedToId: parsed.data.assignedToId ?? session.user.id,
      createdById: session.user.id
    },
    include: taskInclude
  })

  return ok(toTaskItem(task), { status: 201 })
}
