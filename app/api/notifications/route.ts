import { z } from "zod"
import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { toInternalNotificationItem } from "@/lib/backend/activity"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

const notificationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
  unreadOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true")
})

export async function GET(request: Request) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "notifications:view")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền xem thông báo nội bộ." }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const parsed = notificationQuerySchema.safeParse(Object.fromEntries(searchParams))

  if (!parsed.success) {
    return fail({ code: "INVALID_QUERY", message: "Bộ lọc thông báo không hợp lệ." }, { status: 400 })
  }

  const notifications = await prisma.internalNotification.findMany({
    where: {
      recipientId: session.user.id,
      ...(parsed.data.unreadOnly ? { isRead: false } : {})
    },
    include: { actor: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: parsed.data.limit
  })

  return ok(notifications.map(toInternalNotificationItem))
}
