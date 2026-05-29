import { z } from "zod"
import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { toInternalNotificationItem } from "@/lib/backend/activity"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

type RouteContext = {
  params: Promise<{ id: string }>
}

const notificationUpdateSchema = z.object({
  isRead: z.boolean()
})

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "notifications:view")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền cập nhật thông báo nội bộ." }, { status: 403 })
  }

  const body = await request.json()
  const parsed = notificationUpdateSchema.safeParse(body)

  if (!parsed.success) {
    return fail({ code: "INVALID_BODY", message: "Thông tin cập nhật thông báo không hợp lệ." }, { status: 400 })
  }

  const { id } = await context.params
  const existing = await prisma.internalNotification.findFirst({
    where: {
      id,
      recipientId: session.user.id
    }
  })

  if (!existing) {
    return fail({ code: "NOTIFICATION_NOT_FOUND", message: "Không tìm thấy thông báo." }, { status: 404 })
  }

  const notification = await prisma.internalNotification.update({
    where: { id },
    data: {
      isRead: parsed.data.isRead,
      readAt: parsed.data.isRead ? new Date() : null
    },
    include: { actor: { select: { name: true } } }
  })

  return ok(toInternalNotificationItem(notification))
}
