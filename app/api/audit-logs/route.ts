import { z } from "zod"
import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { toAuditLogItem } from "@/lib/backend/activity"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

const auditLogQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  entityType: z.string().min(1).max(80).optional()
})

export async function GET(request: Request) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "activity:view")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền xem log hoạt động." }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const parsed = auditLogQuerySchema.safeParse(Object.fromEntries(searchParams))

  if (!parsed.success) {
    return fail({ code: "INVALID_QUERY", message: "Bộ lọc log hoạt động không hợp lệ." }, { status: 400 })
  }

  const logs = await prisma.auditLog.findMany({
    where: {
      ...(parsed.data.entityType ? { entityType: parsed.data.entityType } : {})
    },
    include: { actor: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: parsed.data.limit
  })

  return ok(logs.map(toAuditLogItem))
}
