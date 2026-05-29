import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { progressLevelToScore } from "@/lib/assessment-scoring"
import { findActiveRubric, toSnapshot } from "@/lib/backend/assessment-rubrics"
import type { WeeklyAssessmentListItem } from "@/lib/contracts/assessment"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { weeklyAssessmentSchema } from "@/lib/validations/assessment"

const weeklyAssessmentInclude = Prisma.validator<Prisma.WeeklyAssessmentInclude>()({
  student: true,
  enrollment: { include: { course: true } },
  teacher: true,
  items: {
    orderBy: [{ domainKey: "asc" }, { skillKey: "asc" }, { outcomeIndex: "asc" }]
  }
})

type WeeklyAssessmentRecord = Prisma.WeeklyAssessmentGetPayload<{ include: typeof weeklyAssessmentInclude }>

function toWeeklyAssessmentListItem(assessment: WeeklyAssessmentRecord): WeeklyAssessmentListItem {
  return {
    id: assessment.id,
    enrollmentId: assessment.enrollmentId,
    studentName: assessment.student.name,
    courseName: assessment.enrollment.course.name,
    subject: assessment.subject,
    weekNumber: assessment.weekNumber,
    status: assessment.status,
    teacherName: assessment.teacher.name,
    checkedItems: assessment.items.filter((item) => item.checked).length,
    totalItems: assessment.items.length,
    updatedAt: assessment.updatedAt.toISOString()
  }
}

export async function GET(request: Request) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "assessments:view")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền xem đánh giá." }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const studentId = searchParams.get("studentId") ?? undefined
  const enrollmentId = searchParams.get("enrollmentId") ?? undefined
  const subject = searchParams.get("subject") ?? undefined
  const classId = searchParams.get("classId") ?? undefined

  const where: Prisma.WeeklyAssessmentWhereInput = {
    ...(studentId ? { studentId } : {}),
    ...(enrollmentId ? { enrollmentId } : {}),
    ...(subject === "FUN" || subject === "ROBOTICS" ? { subject } : {}),
    ...(classId
      ? {
          student: {
            classStudents: {
              some: {
                classId,
                isActive: true
              }
            }
          }
        }
      : {}),
    ...(session.user.role === "TEACHER" ? { teacherId: session.user.id } : {})
  }

  const assessments = await prisma.weeklyAssessment.findMany({
    where,
    include: weeklyAssessmentInclude,
    orderBy: [{ weekNumber: "asc" }, { updatedAt: "desc" }]
  })

  return ok(assessments.map(toWeeklyAssessmentListItem))
}

export async function POST(request: Request) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "assessments:evaluate")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền tạo đánh giá." }, { status: 403 })
  }

  const body = await request.json()
  const parsed = weeklyAssessmentSchema.safeParse(body)

  if (!parsed.success) {
    return fail({ code: "INVALID_BODY", message: "Thông tin đánh giá tuần không hợp lệ." }, { status: 400 })
  }

  const data = parsed.data
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: data.enrollmentId },
    include: { course: true, student: true }
  })

  if (!enrollment || enrollment.studentId !== data.studentId) {
    return fail({ code: "ENROLLMENT_NOT_FOUND", message: "Không tìm thấy khóa đã đăng ký của học viên." }, { status: 404 })
  }

  const subject = enrollment.course.subject
  const activeRubric = await findActiveRubric(prisma, subject)
  const items = data.items.map((item) => ({
    ...item,
    score: item.score ?? (item.progressLevel ? progressLevelToScore(item.progressLevel) || undefined : undefined),
    checked: subject === "ROBOTICS" ? typeof (item.score ?? (item.progressLevel ? progressLevelToScore(item.progressLevel) || undefined : undefined)) === "number" : item.checked
  }))
  const checkedCount = items.filter((item) => item.checked).length
  const status = data.status ?? (data.items.length === 0 ? "NOT_STARTED" : checkedCount === data.items.length ? "COMPLETE" : "IN_PROGRESS")

  const assessment = await prisma.weeklyAssessment.upsert({
    where: {
      enrollmentId_weekNumber_subject: {
        enrollmentId: data.enrollmentId,
        weekNumber: data.weekNumber,
        subject
      }
    },
    update: {
      rubricVersion: data.rubricVersion ?? activeRubric.rubric.version,
      rubricConfigId: activeRubric.configId,
      rubricSnapshot: toSnapshot(activeRubric.rubric),
      status,
      comment: data.comment,
      teacherId: data.teacherId ?? session.user.id,
      items: {
        deleteMany: {},
        create: items.map((item) => ({
          domainKey: item.domainKey,
          skillKey: item.skillKey,
          outcomeIndex: item.outcomeIndex,
          checked: item.checked,
          score: item.score,
          progressLevel: item.progressLevel,
          comment: item.comment,
          evidenceUrl: item.evidenceUrl
        }))
      }
    },
    create: {
      studentId: data.studentId,
      enrollmentId: data.enrollmentId,
      subject,
      rubricVersion: data.rubricVersion ?? activeRubric.rubric.version,
      rubricConfigId: activeRubric.configId,
      rubricSnapshot: toSnapshot(activeRubric.rubric),
      weekNumber: data.weekNumber,
      status,
      teacherId: data.teacherId ?? session.user.id,
      comment: data.comment,
      items: {
        create: items.map((item) => ({
          domainKey: item.domainKey,
          skillKey: item.skillKey,
          outcomeIndex: item.outcomeIndex,
          checked: item.checked,
          score: item.score,
          progressLevel: item.progressLevel,
          comment: item.comment,
          evidenceUrl: item.evidenceUrl
        }))
      }
    },
    include: {
      ...weeklyAssessmentInclude
    }
  })

  return ok(toWeeklyAssessmentListItem(assessment), { status: 201 })
}
