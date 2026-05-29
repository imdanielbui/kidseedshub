import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { toCourseFeedbackItem } from "@/lib/backend/course-feedback"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { courseFeedbackCreateSchema } from "@/lib/validations/course-feedback"

export async function POST(request: Request) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "portal:view_child")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền gửi feedback phụ huynh." }, { status: 403 })
  }

  const body = await request.json()
  const parsed = courseFeedbackCreateSchema.safeParse(body)

  if (!parsed.success) {
    return fail({ code: "INVALID_BODY", message: "Feedback không hợp lệ." }, { status: 400 })
  }

  const parent = await prisma.parent.findUnique({
    where: { userId: session.user.id },
    include: {
      students: {
        select: { id: true }
      }
    }
  })

  if (!parent || !parent.students.some((student) => student.id === parsed.data.studentId)) {
    return fail({ code: "FORBIDDEN_CHILD", message: "Bạn chỉ được gửi feedback cho học viên của mình." }, { status: 403 })
  }

  const feedback = await prisma.courseFeedback.create({
    data: {
      studentId: parsed.data.studentId,
      parentId: parent.id,
      teachingQuality: parsed.data.teachingQuality,
      teacherAttitude: parsed.data.teacherAttitude,
      studentProgress: parsed.data.studentProgress,
      wouldRecommend: parsed.data.wouldRecommend,
      comment: parsed.data.comment?.trim() || undefined
    },
    include: {
      student: true,
      parent: { include: { user: true } }
    }
  })

  return ok(toCourseFeedbackItem(feedback), { status: 201 })
}
