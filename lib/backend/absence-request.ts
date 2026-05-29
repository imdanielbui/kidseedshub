import { Prisma } from "@prisma/client"
import { dateKey } from "@/lib/backend/class-schedule"
import type { AbsenceRequestItem } from "@/lib/contracts/absence-requests"

export const absenceRequestInclude = Prisma.validator<Prisma.AbsenceRequestInclude>()({
  parent: { include: { user: true } },
  student: true,
  reviewedBy: true,
  classSession: {
    include: {
      class: { include: { course: true } },
      attendances: true
    }
  }
})

export type AbsenceRequestRecord = Prisma.AbsenceRequestGetPayload<{ include: typeof absenceRequestInclude }>

export function toAbsenceRequestItem(request: AbsenceRequestRecord): AbsenceRequestItem {
  const attendance = request.classSession.attendances.find((item) => item.enrollmentId)

  return {
    id: request.id,
    studentId: request.studentId,
    studentName: request.student.name,
    parentName: request.parent.user.name,
    classSessionId: request.classSessionId,
    className: request.classSession.class.name,
    courseName: request.classSession.class.course.name,
    sessionDate: dateKey(request.classSession.date),
    startTime: request.classSession.startTime ?? request.classSession.class.startTime,
    endTime: request.classSession.endTime ?? request.classSession.class.endTime,
    reason: request.reason,
    status: request.status,
    adminNote: request.adminNote ?? undefined,
    reviewedByName: request.reviewedBy?.name,
    reviewedAt: request.reviewedAt?.toISOString(),
    createdAt: request.createdAt.toISOString(),
    attendanceStatus: attendance?.status
  }
}
