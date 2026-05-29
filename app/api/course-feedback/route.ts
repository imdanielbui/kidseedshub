import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { toCourseFeedbackItem } from "@/lib/backend/course-feedback"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "reports:view_all")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền xem feedback phụ huynh." }, { status: 403 })
  }

  const feedbacks = await prisma.courseFeedback.findMany({
    include: {
      student: true,
      parent: { include: { user: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 50
  })

  return ok(feedbacks.map(toCourseFeedbackItem))
}
