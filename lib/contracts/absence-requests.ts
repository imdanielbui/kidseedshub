import type { AttendanceStatusKey } from "@/lib/contracts/classes"

export const absenceRequestStatusLabels = {
  PENDING: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Từ chối"
} as const

export type AbsenceRequestStatusKey = keyof typeof absenceRequestStatusLabels

export type AbsenceRequestItem = {
  id: string
  studentId: string
  studentName: string
  parentName: string
  classSessionId: string
  className: string
  courseName: string
  sessionDate: string
  startTime: string
  endTime: string
  reason: string
  status: AbsenceRequestStatusKey
  adminNote?: string
  reviewedByName?: string
  reviewedAt?: string
  createdAt: string
  attendanceStatus?: AttendanceStatusKey
}
