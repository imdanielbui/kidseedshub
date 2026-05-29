import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { assessmentItemScore, roboticsAgeGroupFromBirthDate } from "@/lib/assessment-scoring"
import { rubricFromSnapshot } from "@/lib/backend/assessment-rubrics"
import { finalAssessmentMeetsRequiredWeeks, requiredWeeksFromClass } from "@/lib/backend/final-assessments"
import { roboticsSkillSummaries } from "@/lib/backend/robotics-assessment-report"
import type { FinalReportDetail } from "@/lib/contracts/assessment"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

type RouteContext = {
  params: Promise<{ id: string }>
}

const finalReportInclude = Prisma.validator<Prisma.FinalAssessmentInclude>()({
  student: { include: { parent: { include: { user: true } } } },
  enrollment: { include: { course: true } },
  teacher: true,
  publishedBy: true
})

type FinalReportRecord = Prisma.FinalAssessmentGetPayload<{ include: typeof finalReportInclude }>

function toFinalReportDetail(
  assessment: FinalReportRecord,
  weeklyAssessments: Prisma.WeeklyAssessmentGetPayload<{ include: { items: true } }>[],
  className?: string
): FinalReportDetail {
  const snapshotSource = weeklyAssessments.find((weekly) => weekly.rubricSnapshot)?.rubricSnapshot
  const rubric = rubricFromSnapshot(snapshotSource, assessment.subject, assessment.rubricVersion)
  const checkedScores = new Map<string, number>()
  const ageGroup = roboticsAgeGroupFromBirthDate(assessment.student.birthDate)

  for (const item of weeklyAssessments.flatMap((weekly) => weekly.items)) {
    if (!item.checked) continue

    const key = `${item.domainKey}:${item.skillKey}:${item.outcomeIndex}`
    checkedScores.set(key, Math.max(checkedScores.get(key) ?? 0, assessmentItemScore(item)))
  }

  const domainSummaries = rubric.domains.map((domain) => {
    const keys = domain.skills.flatMap((skill) => skill.outcomes.map((_, outcomeIndex) => `${domain.key}:${skill.key}:${outcomeIndex}`))
    const checkedItems = keys.filter((key) => checkedScores.has(key)).length
    const totalScore = keys.reduce((total, key) => total + (checkedScores.get(key) ?? 0), 0)

    return {
      domainKey: domain.key,
      label: domain.label,
      scoreOutOfFive: keys.length ? Math.round((totalScore / keys.length) * 10) / 10 : 0,
      checkedItems,
      totalItems: keys.length,
      status: keys.length > 0 && checkedItems >= keys.length ? "COMPLETE" as const : checkedItems > 0 ? "IN_PROGRESS" as const : "NOT_STARTED" as const
    }
  })

  return {
    id: assessment.id,
    studentId: assessment.studentId,
    studentName: assessment.student.name,
    parentName: assessment.student.parent.user.name,
    parentPhone: assessment.student.parent.user.phone,
    enrollmentId: assessment.enrollmentId,
    courseName: assessment.enrollment.course.name,
    className,
    ageGroup: ageGroup.ageGroup,
    ageGroupIsDefault: ageGroup.isDefault,
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
    createdAt: assessment.createdAt.toISOString(),
    rubric,
    domainSummaries,
    weeklySummaries: weeklyAssessments.map((weekly) => ({
      weekNumber: weekly.weekNumber,
      status: weekly.status,
      checkedItems: weekly.items.filter((item) => item.checked).length,
      totalItems: weekly.items.length,
      comment: weekly.comment ?? undefined
    })),
    roboticsSkillSummaries:
      assessment.subject === "ROBOTICS"
        ? roboticsSkillSummaries(weeklyAssessments, assessment.rubricVersion, ageGroup.ageGroup)
        : undefined
  }
}

export async function GET(_: Request, context: RouteContext) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  const { id } = await context.params
  const assessment = await prisma.finalAssessment.findUnique({
    where: { id },
    include: finalReportInclude
  })

  if (!assessment) {
    return fail({ code: "FINAL_ASSESSMENT_NOT_FOUND", message: "Không tìm thấy báo cáo cuối khóa." }, { status: 404 })
  }

  if (session.user.role === "PARENT") {
    const parent = await prisma.parent.findUnique({ where: { userId: session.user.id } })

    if (!parent || parent.id !== assessment.student.parentId || assessment.status !== "PUBLISHED") {
      return fail({ code: "FORBIDDEN", message: "Bạn không có quyền xem báo cáo này." }, { status: 403 })
    }
  } else if (!can(session.user.role, "assessments:view")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền xem báo cáo này." }, { status: 403 })
  }

  const [weeklyAssessments, classStudent] = await Promise.all([
    prisma.weeklyAssessment.findMany({
      where: {
        enrollmentId: assessment.enrollmentId,
        subject: assessment.subject,
        status: "COMPLETE"
      },
      include: { items: true },
      orderBy: { weekNumber: "asc" }
    }),
    prisma.classStudent.findFirst({
      where: {
        studentId: assessment.studentId,
        isActive: true,
        class: { courseId: assessment.enrollment.courseId }
      },
      include: { class: { include: { course: true, _count: { select: { sessions: true } } } } }
    })
  ])
  const requiredWeeks = classStudent ? requiredWeeksFromClass(classStudent.class) : assessment.requiredWeeks

  if (session.user.role === "PARENT" && !finalAssessmentMeetsRequiredWeeks(assessment, requiredWeeks)) {
    return fail({ code: "FORBIDDEN", message: "Báo cáo cuối khóa này chưa đủ điều kiện gửi phụ huynh." }, { status: 403 })
  }

  return ok(toFinalReportDetail(assessment, weeklyAssessments, classStudent?.class.name))
}
