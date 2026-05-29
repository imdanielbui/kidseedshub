import { auth } from "@/lib/auth"
import { fail } from "@/lib/api-response"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "portal:view_child")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền tải báo cáo phụ huynh." }, { status: 403 })
  }

  const { id } = await context.params
  const assessment = await prisma.finalAssessment.findFirst({
    where: {
      id,
      status: "PUBLISHED",
      student: {
        parent: {
          userId: session.user.id
        }
      }
    },
    include: {
      student: true,
      enrollment: { include: { course: true } },
      teacher: true
    }
  })

  if (!assessment) {
    return fail({ code: "REPORT_NOT_FOUND", message: "Không tìm thấy báo cáo cuối khóa." }, { status: 404 })
  }

  const content = [
    "Kid Seeds Hub - Final Assessment",
    `Student: ${assessment.student.name}`,
    `Course: ${assessment.enrollment.course.name}`,
    `Subject: ${assessment.subject}`,
    `Teacher: ${assessment.teacher.name}`,
    `Completed weeks: ${assessment.completedWeeks}/${assessment.requiredWeeks}`,
    "",
    "Strengths:",
    assessment.strengths,
    "",
    "Improvements:",
    assessment.improvements,
    "",
    "Teacher summary:",
    assessment.teacherSummary,
    "",
    "Next steps:",
    assessment.nextSteps ?? ""
  ].join("\n")
  const filename = `kidseedshub-final-assessment-${assessment.student.name.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}.txt`

  return new Response(content, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`
    }
  })
}
