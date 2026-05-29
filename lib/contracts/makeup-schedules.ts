import type { AttendanceStatusKey } from "@/lib/contracts/classes"

export type MakeupScheduleItem = {
  id: string
  studentId: string
  studentName: string
  parentName: string
  courseName: string
  className?: string
  teacherName?: string
  sessionDate: string
  startTime?: string
  endTime?: string
  room?: string
  status: AttendanceStatusKey
  note?: string
  makeupDate?: string
  markedByName: string
}
