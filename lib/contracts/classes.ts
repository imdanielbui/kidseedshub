import type { AttendanceStatus } from "@prisma/client"
import type { SubjectKey } from "@/lib/contracts/assessment"

export const attendanceStatusLabels = {
  PRESENT: "Có mặt",
  ABSENT_EXCUSED: "Nghỉ phép",
  ABSENT_NO_EXCUSE: "Vắng"
} as const satisfies Record<AttendanceStatus, string>

export type AttendanceStatusKey = keyof typeof attendanceStatusLabels

export type TodayClassStudent = {
  studentId: string
  studentName: string
  parentName: string
  parentPhone: string
  healthNote?: string
  enrollmentId?: string
  attendanceId?: string
  sessionsRemaining: number
  attendanceStatus?: AttendanceStatusKey
  attendanceNote?: string
  photoCount: number
}

export type TodayClassItem = {
  id: string
  name: string
  courseName: string
  subject: SubjectKey
  teacherName: string
  startTime: string
  endTime: string
  room?: string
  students: TodayClassStudent[]
}

export type AttendanceMarkResult = {
  id: string
  enrollmentId: string
  studentId: string
  studentName: string
  status: AttendanceStatusKey
  note?: string
  date: string
  sessionsBought: number
  sessionsUsed: number
  sessionsRemaining: number
  markedByName: string
}

export type ClassPhotoListItem = {
  id: string
  studentId: string
  attendanceId?: string
  url: string
  takenAt: string
  isFeatured: boolean
}
