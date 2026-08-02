import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { assessmentItemScore, roboticsAgeGroupForAssessment } from "@/lib/assessment-scoring"
import { rubricFromSnapshot } from "@/lib/backend/assessment-rubrics"
import { finalAssessmentMeetsRequiredWeeks, requiredWeeksFromClass } from "@/lib/backend/final-assessments"
import { roboticsReportText } from "@/lib/backend/robotics-assessment-report"
import type { RoboticsAgeGroup } from "@/lib/contracts/assessment"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { finalClassPublishSchema } from "@/lib/validations/assessment"

const classInclude = Prisma.validator<Prisma.ClassInclude>()({
  course: true,
  _count: { select: { sessions: true } },
  teacher: true,
  students: {
    where: { isActive: true },
    include: {
      student: {
        include: {
          parent: { include: { user: true } },
          enrollments: true,
          finalAssessments: true,
          weeklyAssessments: {
            include: { items: true },
            orderBy: { weekNumber: "asc" }
          }
        }
      }
    },
    orderBy: { joinedAt: "asc" }
  }
})

type ClassRecord = Prisma.ClassGetPayload<{ include: typeof classInclude }>
type ClassStudentRecord = ClassRecord["students"][number]
type WeeklyRecord = ClassRecord["students"][number]["student"]["weeklyAssessments"][number]
type FinalRecord = ClassStudentRecord["student"]["finalAssessments"][number]
type PublishStudentResult =
  | { status: "DRAFT_SAVED"; finalAssessmentId: string }
  | { status: "PUBLISHED"; finalAssessmentId: string }
  | { status: "ALREADY_PUBLISHED"; finalAssessmentId: string }
  | { status: "SKIPPED"; reason: string }

function coverageFromWeeklyAssessments(weeklyAssessments: WeeklyRecord[], subject: string) {
  const firstVersion = weeklyAssessments[0]?.rubricVersion ?? `${subject.toLowerCase()}-rubric`
  const snapshot = weeklyAssessments.find((assessment) => assessment.rubricSnapshot)?.rubricSnapshot
  const rubric = rubricFromSnapshot(snapshot, subject, firstVersion)
  const checkedScores = new Map<string, number>()

  for (const item of weeklyAssessments.flatMap((assessment) => assessment.items)) {
    if (!item.checked) continue

    const key = `${item.domainKey}:${item.skillKey}:${item.outcomeIndex}`
    checkedScores.set(key, Math.max(checkedScores.get(key) ?? 0, assessmentItemScore(item)))
  }

  const domains = rubric.domains.map((domain) => {
    const keys = domain.skills.flatMap((skill) => skill.outcomes.map((_, outcomeIndex) => `${domain.key}:${skill.key}:${outcomeIndex}`))
    const checkedItems = keys.filter((key) => checkedScores.has(key)).length
    const totalScore = keys.reduce((total, key) => total + (checkedScores.get(key) ?? 0), 0)

    return {
      domainKey: domain.key,
      label: domain.label,
      scoreOutOfFive: keys.length ? Math.round((totalScore / keys.length) * 10) / 10 : 0,
      checkedItems,
      totalItems: keys.length,
      complete: keys.length > 0 && checkedItems >= keys.length
    }
  })

  return {
    completedDomains: domains.filter((domain) => domain.complete).length,
    totalDomains: domains.length,
    missingDomains: domains.filter((domain) => !domain.complete).map((domain) => domain.label)
  }
}

function labelsFromRubric(weeklyAssessments: WeeklyRecord[], subject: string, version: string) {
  const snapshot = weeklyAssessments.find((assessment) => assessment.rubricSnapshot)?.rubricSnapshot
  const rubric = rubricFromSnapshot(snapshot, subject, version)
  const labels = new Map<string, string>()

  for (const domain of rubric.domains) {
    for (const skill of domain.skills) {
      for (const [outcomeIndex, outcome] of skill.outcomes.entries()) {
        labels.set(`${domain.key}:${skill.key}:${outcomeIndex}`, `${skill.label}: ${outcome}`)
      }
    }
  }

  return labels
}

function reportText(weeklyAssessments: WeeklyRecord[], subject: string, ageGroup?: RoboticsAgeGroup) {
  const firstVersion = weeklyAssessments[0]?.rubricVersion ?? `${subject.toLowerCase()}-rubric`

  if (subject === "ROBOTICS") {
    return roboticsReportText(weeklyAssessments, firstVersion, ageGroup)
  }

  const labels = labelsFromRubric(weeklyAssessments, subject, firstVersion)
  const checkedLabels = weeklyAssessments
    .flatMap((assessment) => assessment.items)
    .filter((item) => item.checked)
    .map((item) => labels.get(`${item.domainKey}:${item.skillKey}:${item.outcomeIndex}`))
    .filter((label): label is string => Boolean(label))
  const uniqueChecked = [...new Set(checkedLabels)]
  const comments = weeklyAssessments.map((assessment) => assessment.comment).filter((comment): comment is string => Boolean(comment))

  return {
    rubricVersion: firstVersion,
    strengths: uniqueChecked.slice(0, 4).join("; ") || "Hoàn thành các tiêu chí trọng tâm của khóa học.",
    improvements: "Tiếp tục luyện các tiêu chí chưa ổn định trong những tuần tiếp theo.",
    teacherSummary: comments.slice(0, 3).join(" ") || "Học viên hoàn thành đủ các buổi đánh giá bắt buộc của khóa.",
    nextSteps: "Gợi ý tiếp tục FUN nâng cao để củng cố giao tiếp, tư duy và sáng tạo."
  }
}

function matchingFinalAssessment(finalAssessments: FinalRecord[], enrollmentId: string, subject: string, requiredWeeks: number) {
  return finalAssessments.find(
    (assessment) => assessment.enrollmentId === enrollmentId && assessment.subject === subject && finalAssessmentMeetsRequiredWeeks(assessment, requiredWeeks)
  )
}

function enrollmentForClass(classStudent: ClassStudentRecord, courseId: string) {
  const matches = classStudent.student.enrollments.filter((item) => item.courseId === courseId)
  const active = matches.find((item) => item.isActive)

  if (active) return active

  return matches.reduce<typeof matches[number] | undefined>(
    (latest, item) => (!latest || item.updatedAt > latest.updatedAt ? item : latest),
    undefined
  )
}

function classStudentStatus(klass: ClassRecord, requiredWeeks: number) {
  return klass.students.map((classStudent) => {
    const enrollment = enrollmentForClass(classStudent, klass.courseId)
    const weeklyAssessments = enrollment
      ? classStudent.student.weeklyAssessments.filter((assessment) => assessment.enrollmentId === enrollment.id && assessment.subject === klass.course.subject && assessment.status === "COMPLETE")
      : []
    const finalAssessment = enrollment ? matchingFinalAssessment(classStudent.student.finalAssessments, enrollment.id, klass.course.subject, requiredWeeks) : undefined
    const coverage = coverageFromWeeklyAssessments(weeklyAssessments, klass.course.subject)
    const hasRequiredWeeks = weeklyAssessments.length >= requiredWeeks
    const hasRequiredFunCoverage = klass.course.subject !== "FUN" || coverage.completedDomains >= coverage.totalDomains

    return {
      studentId: classStudent.studentId,
      studentName: classStudent.student.name,
      parentName: classStudent.student.parent.user.name,
      enrollmentId: enrollment?.id,
      completedWeeks: weeklyAssessments.length,
      requiredWeeks,
      completedDomains: coverage.completedDomains,
      totalDomains: coverage.totalDomains,
      missingDomains: coverage.missingDomains,
      finalAssessmentId: finalAssessment?.id,
      finalStatus: finalAssessment?.status,
      eligible: Boolean(enrollment && hasRequiredWeeks && hasRequiredFunCoverage)
    }
  })
}

async function getClass(classId: string, userId: string, role: string) {
  return prisma.class.findFirst({
    where: {
      id: classId,
      ...(role === "TEACHER" ? { teacherId: userId } : {})
    },
    include: classInclude
  })
}

async function publishStudentFinalReport(
  klass: ClassRecord,
  classStudent: ClassStudentRecord,
  requiredWeeks: number,
  publishedById: string,
  mode: "DRAFT" | "PUBLISH"
): Promise<PublishStudentResult> {
  const enrollment = enrollmentForClass(classStudent, klass.courseId)

  if (!enrollment) {
    return { status: "SKIPPED", reason: "Chưa đăng ký khóa học của lớp." }
  }

  const weeklyAssessments = classStudent.student.weeklyAssessments.filter(
    (assessment) => assessment.enrollmentId === enrollment.id && assessment.subject === klass.course.subject && assessment.status === "COMPLETE"
  )

  if (weeklyAssessments.length < requiredWeeks) {
    return { status: "SKIPPED", reason: `Mới đủ ${weeklyAssessments.length}/${requiredWeeks} tuần.` }
  }

  if (klass.course.subject === "FUN") {
    const coverage = coverageFromWeeklyAssessments(weeklyAssessments, klass.course.subject)

    if (coverage.completedDomains < coverage.totalDomains) {
      return {
        status: "SKIPPED",
        reason: `FUN còn thiếu domain: ${coverage.missingDomains.join(", ")}.`
      }
    }
  }

  const existing = matchingFinalAssessment(classStudent.student.finalAssessments, enrollment.id, klass.course.subject, requiredWeeks)

  if (existing?.status === "PUBLISHED") {
    return { status: "ALREADY_PUBLISHED", finalAssessmentId: existing.id }
  }

  const ageGroup = roboticsAgeGroupForAssessment({
    birthDate: classStudent.student.birthDate,
    override: classStudent.student.assessmentAgeGroupOverride
  }).ageGroup
  const generated = reportText(weeklyAssessments, klass.course.subject, ageGroup)
  const isPublishing = mode === "PUBLISH"
  const dataToSave = {
    studentId: classStudent.studentId,
    enrollmentId: enrollment.id,
    subject: klass.course.subject,
    rubricVersion: generated.rubricVersion,
    requiredWeeks,
    completedWeeks: weeklyAssessments.length,
    strengths: generated.strengths,
    improvements: generated.improvements,
    teacherSummary: generated.teacherSummary,
    nextSteps: generated.nextSteps,
    teacherId: publishedById,
    status: isPublishing ? "PUBLISHED" as const : "DRAFT" as const,
    publishedAt: isPublishing ? new Date() : null,
    publishedById: isPublishing ? publishedById : null
  }

  const finalAssessment = existing
    ? await prisma.finalAssessment.update({
        where: { id: existing.id },
        data: dataToSave
      })
    : await prisma.finalAssessment.create({ data: dataToSave })

  return { status: isPublishing ? "PUBLISHED" : "DRAFT_SAVED", finalAssessmentId: finalAssessment.id }
}

export async function GET(request: Request) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "assessments:view")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền xem báo cáo cuối khóa." }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const classId = searchParams.get("classId")
  const requestedRequiredWeeks = Number(searchParams.get("requiredWeeks") ?? "1")

  if (!classId || !Number.isInteger(requestedRequiredWeeks) || requestedRequiredWeeks < 1) {
    return fail({ code: "INVALID_QUERY", message: "Chọn lớp và số tuần bắt buộc hợp lệ." }, { status: 400 })
  }

  const klass = await getClass(classId, session.user.id, session.user.role)

  if (!klass) {
    return fail({ code: "CLASS_NOT_FOUND", message: "Không tìm thấy lớp học hoặc bạn không phụ trách lớp này." }, { status: 404 })
  }

  const requiredWeeks = requiredWeeksFromClass(klass)

  return ok({
    classId: klass.id,
    className: klass.name,
    courseName: klass.course.name,
    subject: klass.course.subject,
    requiredWeeks,
    students: classStudentStatus(klass, requiredWeeks)
  })
}

export async function POST(request: Request) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "assessments:evaluate")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền lưu hoặc gửi báo cáo cuối khóa." }, { status: 403 })
  }

  const body = await request.json()
  const parsed = finalClassPublishSchema.safeParse(body)

  if (!parsed.success) {
    return fail({ code: "INVALID_BODY", message: "Thông tin lưu báo cáo cả lớp không hợp lệ." }, { status: 400 })
  }

  const data = parsed.data
  const klass = await getClass(data.classId, session.user.id, session.user.role)

  if (!klass) {
    return fail({ code: "CLASS_NOT_FOUND", message: "Không tìm thấy lớp học hoặc bạn không phụ trách lớp này." }, { status: 404 })
  }

  const requiredWeeks = requiredWeeksFromClass(klass)
  let draftCount = 0
  let publishedCount = 0
  let alreadyPublishedCount = 0
  const skippedStudents: Array<{ studentId: string; studentName: string; reason: string }> = []
  let finalAssessmentId: string | undefined
  const targetStudents = data.studentId ? klass.students.filter((classStudent) => classStudent.studentId === data.studentId) : klass.students

  if (data.studentId && targetStudents.length === 0) {
    return fail({ code: "STUDENT_NOT_IN_CLASS", message: "Học sinh không nằm trong lớp này." }, { status: 404 })
  }

  for (const classStudent of targetStudents) {
    const result = await publishStudentFinalReport(klass, classStudent, requiredWeeks, session.user.id, data.mode)

    if (result.status === "SKIPPED") {
      skippedStudents.push({ studentId: classStudent.studentId, studentName: classStudent.student.name, reason: result.reason })
      continue
    }

    finalAssessmentId = result.finalAssessmentId

    if (result.status === "ALREADY_PUBLISHED") {
      alreadyPublishedCount += 1
      continue
    }

    if (result.status === "DRAFT_SAVED") {
      draftCount += 1
    } else {
      publishedCount += 1
    }
  }

  return ok({
    classId: klass.id,
    className: klass.name,
    draftCount,
    publishedCount,
    alreadyPublishedCount,
    skippedCount: skippedStudents.length,
    skippedStudents,
    finalAssessmentId
  })
}
