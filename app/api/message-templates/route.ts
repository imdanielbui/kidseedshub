import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import type { ZaloTemplateItem } from "@/lib/contracts/reminders"
import { can } from "@/lib/permissions"
import { zaloTemplates } from "@/lib/message-templates"

export async function GET() {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "tasks:manage")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền xem template Zalo." }, { status: 403 })
  }

  return ok<ZaloTemplateItem[]>(zaloTemplates)
}
