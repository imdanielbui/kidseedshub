import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { averageScore, progressLevelToScore, roboticsAgeGroupForAssessment } from "@/lib/assessment-scoring"
import { findActiveRubric, toSnapshot } from "@/lib/backend/assessment-rubrics"
import { dateKey } from "@/lib/backend/class-schedule"
import type { WeeklyClassAssessmentDetail, WeeklyAssessmentMatrixItem, WeeklyAssessmentWeekOption } from "@/lib/contracts/assessment"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { weeklyClassAssessmentSchema } from "@/lib/validations/assessment"

const classInclude = Prisma.validator<Prisma.ClassInclude>()({
  course: true,
  teacher: true,
  students: {
    where: { isActive: true },
    include: {
      student: {
        include: {
          parent: { include: { user: true } },
          enrollments: { include: { course: true } }
        }
      }
    },
    orderBy: { joinedAt: "asc" }
  },
  sessions: {
    orderBy: [{ date: "asc" }, { startTime: "asc" }]
  }
})

type ClassRecord = Prisma.ClassGetPayload<{ include: typeof classInclude }>

function emptyItems(rubric: WeeklyClassAssessmentDetail["rubric"]): WeeklyAssessmentMatrixItem["items"] {
  return rubric.domains.flatMap((domain) =>
    domain.skills.flatMap((skill) =>
      skill.outcomes.map((_, outcomeIndex) => ({
        domainKey: domain.key,
        skillKey: skill.key,
        outcomeIndex,
        checked: false
      }))
    )
  )
}

function itemKey(item: { domainKey: string; skillKey: string; outcomeIndex: number }) {
  return `${item.domainKey}:${item.skillKey}:${item.outcomeIndex}`
}

function enrollmentForClass(classStudent: ClassRecord["students"][number], courseId: string) {
  const matches = classStudent.student.enrollments.filter((enrollment) => enrollment.courseId === courseId)
  const activeEnrollment = matches.find((enrollment) => enrollment.isActive)

  if (activeEnrollment) return activeEnrollment

  return matches.reduce<typeof matches[number] | undefined>(
    (latest, enrollment) => (!latest || enrollment.updatedAt > latest.updatedAt ? enrollment : latest),
    undefined
  )
}

function scoreOutOfFive(items: WeeklyAssessmentMatrixItem["items"]) {
  return averageScore(items)
}

function classSkillComparison(
  rubric: WeeklyClassAssessmentDetail["rubric"],
  students: WeeklyAssessmentMatrixItem[]
): WeeklyClassAssessmentDetail["skillComparison"] {
  return rubric.domains.flatMap((domain) =>
    domain.skills.map((skill) => {
      const studentScores = students.flatMap((student) => {
        const skillItems = student.items.filter((item) => item.domainKey === domain.key && item.skillKey === skill.key)
        const checkedItems = skillItems.filter((item) => item.checked).length

        return checkedItems > 0 ? [scoreOutOfFive(skillItems)] : []
      })
      const checkedItems = students.reduce((total, student) => {
        return total + student.items.filter((item) => item.domainKey === domain.key && item.skillKey === skill.key && item.checked).length
      }, 0)
      const totalItems = students.reduce((total, student) => {
        return total + student.items.filter((item) => item.domainKey === domain.key && item.skillKey === skill.key).length
      }, 0)
      const averageScore = studentScores.length ? Math.round((studentScores.reduce((total, score) => total + score, 0) / studentScores.length) * 10) / 10 : 0

      return {
        domainKey: domain.key,
        domainLabel: domain.label,
        skillKey: skill.key,
        skillLabel: skill.label,
        averageScore,
        checkedStudents: studentScores.length,
        totalStudents: students.length,
        checkedItems,
        totalItems,
        completionRate: students.length ? Math.round((studentScores.length / students.length) * 100) : 0
      }
    })
  )
}

function domainProgress(rubric: WeeklyClassAssessmentDetail["rubric"], items: WeeklyAssessmentMatrixItem["items"]): WeeklyAssessmentMatrixItem["domainProgress"] {
  return rubric.domains.map((domain) => {
    const domainItems = items.filter((item) => item.domainKey === domain.key)
    const checkedItems = domainItems.filter((item) => item.checked).length
    const totalItems = domainItems.length

    return {
      domainKey: domain.key,
      label: domain.label,
      scoreOutOfFive: scoreOutOfFive(domainItems),
      checkedItems,
      totalItems,
      status: totalItems > 0 && checkedItems >= totalItems ? "COMPLETE" : checkedItems > 0 ? "IN_PROGRESS" : "NOT_STARTED"
    }
  })
}

function startOfToday() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}

function buildWeekOptions(
  klass: ClassRecord,
  weeklyAssessments: Array<{ weekNumber: number; status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETE" }>,
  totalStudents: number
): WeeklyAssessmentWeekOption[] {
  const today = startOfToday()
  const scheduledSessions = klass.sessions.filter((session) => session.status !== "CANCELED")
  const plannedWeeks = Math.max(1, klass.plannedSessions ?? klass.course.totalSessions, scheduledSessions.length)
  const assessmentsByWeek = new Map<number, Array<{ status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETE" }>>()

  for (const assessment of weeklyAssessments) {
    const items = assessmentsByWeek.get(assessment.weekNumber) ?? []
    items.push(assessment)
    assessmentsByWeek.set(assessment.weekNumber, items)
  }

  return Array.from({ length: plannedWeeks }, (_, index) => {
    const weekNumber = index + 1
    const session = scheduledSessions[index]
    const assessments = assessmentsByWeek.get(weekNumber) ?? []
    const completeStudents = assessments.filter((assessment) => assessment.status === "COMPLETE").length
    const hasStarted = assessments.some((assessment) => assessment.status !== "NOT_STARTED")
    const isDue = session ? session.date <= today : weekNumber <= scheduledSessions.filter((item) => item.date <= today).length
    const status: WeeklyAssessmentWeekOption["status"] =
      totalStudents > 0 && completeStudents >= totalStudents
        ? "COMPLETE"
        : hasStarted
          ? "IN_PROGRESS"
          : isDue
            ? "MISSING"
            : "NOT_DUE"

    return {
      weekNumber,
      label: session ? `Tuần ${weekNumber} - ${dateKey(session.date)}` : `Tuần ${weekNumber}`,
      date: session ? dateKey(session.date) : undefined,
      isDue,
      completeStudents,
      totalStudents,
      status
    }
  })
}

function suggestedWeek(weeks: WeeklyAssessmentWeekOption[]) {
  const missingDue = weeks.find((week) => week.isDue && week.status !== "COMPLETE")

  if (missingDue) return missingDue.weekNumber

  const latestDue = [...weeks].reverse().find((week) => week.isDue)
  return latestDue?.weekNumber ?? weeks[0]?.weekNumber ?? 1
}

function toDetail(
  klass: ClassRecord,
  weekNumber: number,
  suggestedWeekNumber: number,
  availableWeeks: WeeklyAssessmentWeekOption[],
  rubric: WeeklyClassAssessmentDetail["rubric"],
  assessments: Prisma.WeeklyAssessmentGetPayload<{ include: { items: true } }>[]
): WeeklyClassAssessmentDetail {
  const assessmentByEnrollmentId = new Map(assessments.map((assessment) => [assessment.enrollmentId, assessment]))
  const totalItems = emptyItems(rubric).length
  const students: WeeklyAssessmentMatrixItem[] = klass.students.map((classStudent) => {
    const enrollment = enrollmentForClass(classStudent, klass.courseId)
    const assessment = enrollment ? assessmentByEnrollmentId.get(enrollment.id) : undefined
    const savedItems = new Map((assessment?.items ?? []).map((item) => [itemKey(item), item]))
    const savedRoboticsItems = new Map((assessment?.items ?? []).map((item) => [`${item.skillKey}:${item.outcomeIndex}`, item]))
    const ageGroup = roboticsAgeGroupForAssessment({ birthDate: classStudent.student.birthDate, override: classStudent.student.assessmentAgeGroupOverride })
    const items = emptyItems(rubric).map((item) => {
      const saved = savedItems.get(itemKey(item)) ?? (klass.course.subject === "ROBOTICS" ? savedRoboticsItems.get(`${item.skillKey}:${item.outcomeIndex}`) : undefined)
      const fallbackScore = saved?.score ?? (saved?.progressLevel ? progressLevelToScore(saved.progressLevel) : undefined)

      return {
        ...item,
        checked: klass.course.subject === "ROBOTICS" ? typeof fallbackScore === "number" : saved?.checked ?? false,
        score: fallbackScore,
        progressLevel: saved?.progressLevel ?? undefined,
        comment: saved?.comment ?? undefined,
        evidenceUrl: saved?.evidenceUrl ?? undefined
      }
    })

    return {
      id: assessment?.id,
      studentId: classStudent.studentId,
      studentName: classStudent.student.name,
      birthDate: classStudent.student.birthDate?.toISOString(),
      ageGroup: ageGroup.ageGroup,
      ageGroupIsDefault: ageGroup.isDefault,
      parentName: classStudent.student.parent.user.name,
      parentPhone: classStudent.student.parent.user.phone,
      healthNote: classStudent.student.healthNote ?? undefined,
      enrollmentId: enrollment?.id,
      status: assessment?.status ?? "NOT_STARTED",
      comment: assessment?.comment ?? undefined,
      checkedItems: items.filter((item) => item.checked).length,
      totalItems,
      domainProgress: domainProgress(rubric, items),
      items
    }
  })

  return {
    classId: klass.id,
    className: klass.name,
    courseId: klass.courseId,
    courseName: klass.course.name,
    subject: klass.course.subject,
    teacherName: klass.teacher.name,
    weekNumber,
    suggestedWeekNumber,
    availableWeeks,
    rubric,
    students,
    skillComparison: classSkillComparison(rubric, students)
  }
}

async function getClassForAssessment(classId: string, userId: string, role: string) {
  return prisma.class.findFirst({
    where: {
      id: classId,
      ...(role === "TEACHER" ? { teacherId: userId } : {})
    },
    include: classInclude
  })
}

export async function GET(request: Request) {
  try {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "assessments:view")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền xem đánh giá." }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const classId = searchParams.get("classId")
  const weekNumberParam = searchParams.get("weekNumber")
  const parsedWeekNumber = weekNumberParam ? Number(weekNumberParam) : undefined

  if (!classId || (parsedWeekNumber !== undefined && (!Number.isInteger(parsedWeekNumber) || parsedWeekNumber < 1))) {
    return fail({ code: "INVALID_QUERY", message: "Chọn lớp và tuần hợp lệ." }, { status: 400 })
  }

  const klass = await getClassForAssessment(classId, session.user.id, session.user.role)

  if (!klass) {
    return fail({ code: "CLASS_NOT_FOUND", message: "Không tìm thấy lớp học hoặc bạn không phụ trách lớp này." }, { status: 404 })
  }

  const activeRubric = await findActiveRubric(prisma, klass.course.subject)
  const enrollmentIds = klass.students
    .map((classStudent) => enrollmentForClass(classStudent, klass.courseId)?.id)
    .filter((id): id is string => Boolean(id))
  const weeklyAssessments = enrollmentIds.length
    ? await prisma.weeklyAssessment.findMany({
        where: {
          enrollmentId: { in: enrollmentIds },
          subject: klass.course.subject
        },
        select: {
          weekNumber: true,
          status: true
        }
      })
    : []
  const availableWeeks = buildWeekOptions(klass, weeklyAssessments, enrollmentIds.length)
  const suggestedWeekNumber = suggestedWeek(availableWeeks)
  const weekNumber = parsedWeekNumber ?? suggestedWeekNumber

  const assessments = enrollmentIds.length
    ? await prisma.weeklyAssessment.findMany({
        where: {
          enrollmentId: { in: enrollmentIds },
          weekNumber,
          subject: klass.course.subject
        },
        include: { items: true }
      })
    : []

  return ok(toDetail(klass, weekNumber, suggestedWeekNumber, availableWeeks, activeRubric.rubric, assessments))
  } catch (error) {
    console.error("[weekly-assessments/classroom] GET failed", error)

    return fail(
      {
        code: "ASSESSMENT_CLASSROOM_LOAD_FAILED",
        message: "Không tải được đánh giá lớp."
      },
      { status: 500 }
    )
  }
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
  const parsed = weeklyClassAssessmentSchema.safeParse(body)

  if (!parsed.success) {
    return fail({ code: "INVALID_BODY", message: "Thông tin đánh giá lớp không hợp lệ." }, { status: 400 })
  }

  const data = parsed.data
  const klass = await getClassForAssessment(data.classId, session.user.id, session.user.role)

  if (!klass) {
    return fail({ code: "CLASS_NOT_FOUND", message: "Không tìm thấy lớp học hoặc bạn không phụ trách lớp này." }, { status: 404 })
  }

  const activeRubric = await findActiveRubric(prisma, klass.course.subject)
  const isRobotics = klass.course.subject === "ROBOTICS"
  const allowedEnrollmentIds = new Set(
    klass.students
      .map((classStudent) => enrollmentForClass(classStudent, klass.courseId)?.id)
      .filter((id): id is string => Boolean(id))
  )

  for (const assessment of data.assessments) {
    if (!allowedEnrollmentIds.has(assessment.enrollmentId)) {
      return fail({ code: "ENROLLMENT_NOT_IN_CLASS", message: "Có học viên chưa đăng ký khóa học của lớp." }, { status: 400 })
    }
  }

  await prisma.$transaction(
    data.assessments.map((assessment) =>
      prisma.weeklyAssessment.upsert({
        where: {
          enrollmentId_weekNumber_subject: {
            enrollmentId: assessment.enrollmentId,
            weekNumber: data.weekNumber,
            subject: klass.course.subject
          }
        },
        update: {
          rubricVersion: activeRubric.rubric.version,
          rubricConfigId: activeRubric.configId,
          rubricSnapshot: toSnapshot(activeRubric.rubric),
          status: assessment.status,
          comment: assessment.comment,
          teacherId: session.user.id,
          items: {
            deleteMany: {},
            create: assessment.items.map((item) => {
              const score = item.score ?? (item.progressLevel ? progressLevelToScore(item.progressLevel) || undefined : undefined)

              return {
                domainKey: item.domainKey,
                skillKey: item.skillKey,
                outcomeIndex: item.outcomeIndex,
                checked: isRobotics ? typeof score === "number" : item.checked,
                score,
                progressLevel: item.progressLevel,
                comment: item.comment,
                evidenceUrl: item.evidenceUrl
              }
            })
          }
        },
        create: {
          studentId: assessment.studentId,
          enrollmentId: assessment.enrollmentId,
          subject: klass.course.subject,
          rubricVersion: activeRubric.rubric.version,
          rubricConfigId: activeRubric.configId,
          rubricSnapshot: toSnapshot(activeRubric.rubric),
          weekNumber: data.weekNumber,
          status: assessment.status,
          teacherId: session.user.id,
          comment: assessment.comment,
          items: {
            create: assessment.items.map((item) => {
              const score = item.score ?? (item.progressLevel ? progressLevelToScore(item.progressLevel) || undefined : undefined)

              return {
                domainKey: item.domainKey,
                skillKey: item.skillKey,
                outcomeIndex: item.outcomeIndex,
                checked: isRobotics ? typeof score === "number" : item.checked,
                score,
                progressLevel: item.progressLevel,
                comment: item.comment,
                evidenceUrl: item.evidenceUrl
              }
            })
          }
        }
      })
    )
  )

  const enrollmentIds = [...allowedEnrollmentIds]
  const weeklyAssessments = enrollmentIds.length
    ? await prisma.weeklyAssessment.findMany({
        where: {
          enrollmentId: { in: enrollmentIds },
          subject: klass.course.subject
        },
        select: {
          weekNumber: true,
          status: true
        }
      })
    : []
  const availableWeeks = buildWeekOptions(klass, weeklyAssessments, enrollmentIds.length)
  const suggestedWeekNumber = suggestedWeek(availableWeeks)
  const assessments = enrollmentIds.length
    ? await prisma.weeklyAssessment.findMany({
        where: {
          enrollmentId: { in: enrollmentIds },
          weekNumber: data.weekNumber,
          subject: klass.course.subject
        },
        include: { items: true }
      })
    : []

  return ok(toDetail(klass, data.weekNumber, suggestedWeekNumber, availableWeeks, activeRubric.rubric, assessments))
}
