import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { dateKey } from "@/lib/backend/class-schedule"
import { toCourseFeedbackItem } from "@/lib/backend/course-feedback"
import { finalAssessmentMeetsRequiredWeeks, requiredWeeksFromClass } from "@/lib/backend/final-assessments"
import type { FinalAssessmentResult } from "@/lib/contracts/assessment"
import type { ParentPortalOverview } from "@/lib/contracts/parent-portal"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

const parentPortalInclude = Prisma.validator<Prisma.ParentInclude>()({
  user: true,
  students: {
    include: {
      enrollments: {
        include: {
          course: true,
          attendances: {
            include: {
              classSession: { include: { class: { include: { course: true } } } },
              photos: { orderBy: { takenAt: "desc" } }
            },
            orderBy: { date: "desc" }
          }
        }
      },
      classStudents: {
        where: { isActive: true },
        include: {
          class: {
            include: {
              course: true,
              teacher: true,
              _count: { select: { sessions: true } },
              sessions: {
                where: {
                  date: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()) },
                  status: "SCHEDULED"
                },
                include: {
                  absenceRequests: true
                },
                orderBy: [{ date: "asc" }, { startTime: "asc" }],
                take: 6
              }
            }
          }
        }
      },
      finalAssessments: {
        where: { status: "PUBLISHED" },
        include: {
          student: true,
          enrollment: { include: { course: true } },
          teacher: true,
          publishedBy: true
        },
        orderBy: { createdAt: "desc" }
      },
      feedbacks: {
        include: {
          student: true,
          parent: { include: { user: true } }
        },
        orderBy: { createdAt: "desc" }
      },
      makeupEntitlements: {
        include: {
          enrollment: { include: { course: true } },
          classSession: { include: { class: true } },
          walletEntries: true,
          refundExpense: true,
          resolvedBy: true
        },
        orderBy: [{ month: "desc" }, { createdAt: "desc" }]
      },
      walletEntries: {
        include: {
          createdBy: true,
          receipt: true
        },
        orderBy: { createdAt: "desc" }
      }
    }
  }
})

type ParentPortalRecord = Prisma.ParentGetPayload<{ include: typeof parentPortalInclude }>
type FinalAssessmentRecord = ParentPortalRecord["students"][number]["finalAssessments"][number]

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

function toPortalOverview(parent: ParentPortalRecord): ParentPortalOverview {
  return {
    parentName: parent.user.name,
    children: parent.students.map((student) => {
      const courses = student.enrollments.map((enrollment) => ({
        enrollmentId: enrollment.id,
        courseName: enrollment.course.name,
        subject: enrollment.course.subject,
        sessionsBought: enrollment.sessionsBought,
        sessionsUsed: enrollment.sessionsUsed,
        sessionsRemaining: Math.max(0, enrollment.sessionsBought - enrollment.sessionsUsed),
        isActive: enrollment.isActive
      }))

      const upcomingSessions = student.classStudents
        .flatMap(({ class: klass }) =>
          klass.sessions.map((session) => {
            const absenceRequest = session.absenceRequests.find((request) => request.studentId === student.id)

            return {
              id: session.id,
              className: klass.name,
              courseName: klass.course.name,
              subject: klass.course.subject,
              teacherName: klass.teacher.name,
              date: dateKey(session.date),
              startTime: session.startTime ?? klass.startTime,
              endTime: session.endTime ?? klass.endTime,
              room: session.room ?? klass.room ?? undefined,
              absenceRequest: absenceRequest
                ? {
                    id: absenceRequest.id,
                    status: absenceRequest.status,
                    reason: absenceRequest.reason
                  }
                : undefined
            }
          })
        )
        .sort((first, second) => `${first.date} ${first.startTime}`.localeCompare(`${second.date} ${second.startTime}`))
        .slice(0, 8)

      const journal = student.enrollments
        .flatMap((enrollment) =>
          enrollment.attendances.map((attendance) => ({
            id: attendance.id,
            date: dateKey(attendance.date),
            courseName: enrollment.course.name,
            subject: enrollment.course.subject,
            className: attendance.classSession?.class.name,
            status: attendance.status,
            note: attendance.note ?? undefined,
            photos: attendance.photos.map((photo) => ({
              id: photo.id,
              url: photo.url,
              takenAt: photo.takenAt.toISOString()
            }))
          }))
        )
        .sort((first, second) => second.date.localeCompare(first.date))
        .slice(0, 10)
      const requiredWeeksByCourseId = new Map(
        student.classStudents.map(({ class: klass }) => [klass.courseId, requiredWeeksFromClass(klass)])
      )
      const finalAssessments = student.finalAssessments.filter((assessment) =>
        finalAssessmentMeetsRequiredWeeks(assessment, requiredWeeksByCourseId.get(assessment.enrollment.courseId) ?? assessment.requiredWeeks)
      )
      const walletBalance = student.walletEntries.reduce((total, entry) => total.plus(entry.amount), new Prisma.Decimal(0))

      return {
        id: student.id,
        code: student.code,
        name: student.name,
        status: student.status,
        healthNote: student.healthNote ?? undefined,
        courses,
        upcomingSessions,
        journal,
        finalAssessments: finalAssessments.map(toFinalAssessmentResult),
        feedbacks: student.feedbacks.map(toCourseFeedbackItem),
        makeupEntitlements: student.makeupEntitlements.map((entitlement) => ({
          id: entitlement.id,
          enrollmentId: entitlement.enrollmentId,
          courseName: entitlement.enrollment.course.name,
          className: entitlement.classSession?.class.name,
          month: entitlement.month,
          status: entitlement.status,
          isEligible: entitlement.isEligible,
          eligibilityReason: entitlement.eligibilityReason ?? undefined,
          scheduledFor: entitlement.scheduledFor?.toISOString(),
          resolvedAmount: entitlement.resolvedAmount?.toString(),
          resolvedAt: entitlement.resolvedAt?.toISOString(),
          refundExpenseCode: entitlement.refundExpense?.code
        })),
        walletBalance: walletBalance.toString(),
        walletEntries: student.walletEntries.map((entry) => ({
          id: entry.id,
          amount: entry.amount.toString(),
          type: entry.type,
          note: entry.note ?? undefined,
          receiptCode: entry.receipt?.code,
          createdByName: entry.createdBy.name,
          createdAt: entry.createdAt.toISOString()
        }))
      }
    })
  }
}

export async function GET() {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "portal:view_child")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền xem cổng phụ huynh." }, { status: 403 })
  }

  const parent = await prisma.parent.findUnique({
    where: { userId: session.user.id },
    include: parentPortalInclude
  })

  if (!parent) {
    return fail({ code: "PARENT_NOT_FOUND", message: "Không tìm thấy hồ sơ phụ huynh." }, { status: 404 })
  }

  return ok(toPortalOverview(parent))
}
