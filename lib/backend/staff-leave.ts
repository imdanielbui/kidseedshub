import { Prisma } from "@prisma/client"
import { dateKey } from "@/lib/backend/class-schedule"
import type { StaffLeaveImpactedSessionItem, StaffLeaveRequestItem } from "@/lib/contracts/staff-leaves"

export const staffLeaveRequestInclude = Prisma.validator<Prisma.StaffLeaveRequestInclude>()({
  staff: true,
  reviewedBy: true
})

export type StaffLeaveRequestRecord = Prisma.StaffLeaveRequestGetPayload<{ include: typeof staffLeaveRequestInclude }>

export function toStaffLeaveRequestItem(request: StaffLeaveRequestRecord): StaffLeaveRequestItem {
  return {
    id: request.id,
    staffId: request.staffId,
    staffName: request.staff.name,
    staffRole: request.staff.role,
    startDate: dateKey(request.startDate),
    endDate: dateKey(request.endDate),
    type: request.type,
    reason: request.reason,
    status: request.status,
    adminNote: request.adminNote ?? undefined,
    reviewedByName: request.reviewedBy?.name,
    reviewedAt: request.reviewedAt?.toISOString(),
    createdAt: request.createdAt.toISOString()
  }
}

export function toStaffLeaveImpactedSessionItem(
  session: {
    id: string
    classId: string
    date: Date
    startTime: string | null
    endTime: string | null
    room: string | null
    status: string
    substituteTeacherId: string | null
    substituteTeacher: { name: string } | null
    class: {
      name: string
      teacherId: string
      teacher: { name: string }
      course: { name: string }
    }
  },
  staffId: string
): StaffLeaveImpactedSessionItem {
  return {
    id: session.id,
    classId: session.classId,
    className: session.class.name,
    courseName: session.class.course.name,
    date: dateKey(session.date),
    startTime: session.startTime ?? "",
    endTime: session.endTime ?? "",
    room: session.room ?? undefined,
    primaryTeacherName: session.class.teacher.name,
    substituteTeacherName: session.substituteTeacher?.name,
    impactRole: session.substituteTeacherId === staffId ? "SUBSTITUTE" : "PRIMARY",
    status: session.status
  }
}
