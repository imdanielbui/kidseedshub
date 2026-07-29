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
  sessionId?: string
  name: string
  courseName: string
  subject: SubjectKey
  teacherName: string
  startTime: string
  endTime: string
  room?: string
  photoCount: number
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
  studentId?: string
  studentName?: string
  classSessionId?: string
  attendanceId?: string
  url: string
  caption?: string
  takenAt: string
  isFeatured: boolean
  isPublished: boolean
  sentToParentAt?: string
  createdByName?: string
}

export type ClassTimelineAttendanceState = "UPCOMING" | "PENDING" | "PARTIAL" | "COMPLETE" | "CANCELED"

export type ClassTimelineStudent = {
  studentId: string
  studentCode?: string
  studentName: string
  parentName: string
  parentPhone: string
  attendanceId?: string
  attendanceStatus?: AttendanceStatusKey
  attendanceNote?: string
  markedByName?: string
}

export type ClassTimelineSession = {
  id: string
  sessionNumber: number
  date: string
  startTime: string
  endTime: string
  room?: string
  status: "SCHEDULED" | "CANCELED" | "COMPLETED"
  attendanceState: ClassTimelineAttendanceState
  attendanceMarked: number
  attendanceExpected: number
  students: ClassTimelineStudent[]
}

export type ClassTimelineItem = {
  id: string
  code?: string
  name: string
  courseName: string
  subject: SubjectKey
  teacherName: string
  startDate?: string
  endDate?: string
  plannedSessions?: number
  activeStudentCount: number
  sessions: ClassTimelineSession[]
}

export const classPhotoUploadMaxBytes = 8 * 1024 * 1024

export const classPhotoUploadAcceptedMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const
