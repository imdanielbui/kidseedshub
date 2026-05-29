import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import type { FinalAssessmentResult } from "@/lib/contracts/assessment"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { finalAssessmentSchema } from "@/lib/validations/assessment"

const finalAssessmentInclude = Prisma.validator<Prisma.FinalAssessmentInclude>()({
  student: true,
  enrollment: { include: { course: true } },
  teacher: true,
  publishedBy: true
})

type FinalAssessmentRecord = Prisma.FinalAssessmentGetPayload<{ include: typeof finalAssessmentInclude }>

function toFinalAssessmentResult(assessment: FinalAssessmentRecord): FinalAssessmentResult {
  return {
    id: assessment.id,
    studentId: assessment.studentId,
    studentName: assessment.student.name,
    enrollmentId: assessment.enrollmentId,
    courseName: assessment.enrollment.course.name,
    subject: assessment.subject,
    rubricVersion: assessment.rubricVersion,
    requiredWeeks: assessment.requiredWeeks,
    completedWeeks: assessment.completedWeeks,
    strengths: assessment.strengths,
    improvements: assessment.improvements,
    teacherSummary: assessment.teacherSummary,
    nextSteps: assessment.nextSteps ?? undefined,
    teacherName: assessment.teacher.name,
    status: assessment.status,
    publishedAt: assessment.publishedAt?.toISOString(),
    publishedByName: assessment.publishedBy?.name,
    createdAt: assessment.createdAt.toISOString()
  }
}

export async function POST(request: Request) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "assessments:evaluate")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền tạo đánh giá cuối khóa." }, { status: 403 })
  }

  const body = await request.json()
  const parsed = finalAssessmentSchema.safeParse(body)

  if (!parsed.success) {
    return fail({ code: "INVALID_BODY", message: "Thông tin đánh giá cuối khóa không hợp lệ." }, { status: 400 })
  }

  const data = parsed.data
  const completedWeeks = await prisma.weeklyAssessment.count({
    where: {
      enrollmentId: data.enrollmentId,
      subject: data.subject,
      status: "COMPLETE"
    }
  })

  if (completedWeeks < data.requiredWeeks) {
    return fail(
      {
        code: "WEEKLY_ASSESSMENTS_INCOMPLETE",
        message: "Chưa đủ đánh giá tuần để tạo đánh giá cuối khóa."
      },
      { status: 409 }
    )
  }

  const assessment = await prisma.finalAssessment.create({
    data: {
      studentId: data.studentId,
      enrollmentId: data.enrollmentId,
      subject: data.subject,
      rubricVersion: data.rubricVersion,
      requiredWeeks: data.requiredWeeks,
      completedWeeks,
      strengths: data.strengths,
      improvements: data.improvements,
      teacherSummary: data.teacherSummary,
      nextSteps: data.nextSteps,
      teacherId: session.user.id,
      status: "READY"
    },
    include: finalAssessmentInclude
  })

  return ok(toFinalAssessmentResult(assessment), { status: 201 })
}
