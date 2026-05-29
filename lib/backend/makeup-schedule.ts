import type { AttendanceStatus } from "@prisma/client"
import { dateKey } from "@/lib/backend/class-schedule"
import type { MakeupScheduleItem } from "@/lib/contracts/makeup-schedules"

export function toMakeupScheduleItem(attendance: {
  id: string
  date: Date
  status: AttendanceStatus
  note: string | null
  makeupDate: Date | null
  markedBy: { name: string }
  enrollment: {
    student: {
      id: string
      name: string
      parent: { user: { name: string } }
    }
    course: { name: string }
  }
  classSession: {
    startTime: string | null
    endTime: string | null
    room: string | null
    class: {
      name: string
      teacher: { name: string }
    }
  } | null
}): MakeupScheduleItem {
  return {
    id: attendance.id,
    studentId: attendance.enrollment.student.id,
    studentName: attendance.enrollment.student.name,
    parentName: attendance.enrollment.student.parent.user.name,
    courseName: attendance.enrollment.course.name,
    className: attendance.classSession?.class.name,
    teacherName: attendance.classSession?.class.teacher.name,
    sessionDate: dateKey(attendance.date),
    startTime: attendance.classSession?.startTime ?? undefined,
    endTime: attendance.classSession?.endTime ?? undefined,
    room: attendance.classSession?.room ?? undefined,
    status: attendance.status,
    note: attendance.note ?? undefined,
    makeupDate: attendance.makeupDate ? dateKey(attendance.makeupDate) : undefined,
    markedByName: attendance.markedBy.name
  }
}
