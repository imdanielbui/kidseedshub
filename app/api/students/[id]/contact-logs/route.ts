import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import type { StudentContactLogItem } from "@/lib/contracts/students"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { contactLogCreateSchema } from "@/lib/validations/crm"

type RouteContext = {
  params: Promise<{ id: string }>
}

function toContactLogItem(log: {
  id: string
  content: string
  result: StudentContactLogItem["result"]
  createdAt: Date
  loggedBy: { name: string }
}): StudentContactLogItem {
  return {
    id: log.id,
    content: log.content,
    result: log.result,
    loggedByName: log.loggedBy.name,
    createdAt: log.createdAt.toISOString()
  }
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "students:view_all")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền xem lịch sử liên hệ." }, { status: 403 })
  }

  const { id } = await context.params
  const logs = await prisma.contactLog.findMany({
    where: { studentId: id },
    include: { loggedBy: true },
    orderBy: { createdAt: "desc" }
  })

  return ok(logs.map(toContactLogItem))
}

export async function POST(request: Request, context: RouteContext) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "contact_log:create")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền ghi lịch sử liên hệ." }, { status: 403 })
  }

  const body = await request.json()
  const parsed = contactLogCreateSchema.safeParse(body)

  if (!parsed.success) {
    return fail({ code: "INVALID_BODY", message: "Thông tin liên hệ không hợp lệ." }, { status: 400 })
  }

  const { id } = await context.params
  const log = await prisma.contactLog.create({
    data: {
      studentId: id,
      content: parsed.data.content,
      result: parsed.data.result,
      loggedById: session.user.id
    },
    include: { loggedBy: true }
  })

  return ok(toContactLogItem(log), { status: 201 })
}
