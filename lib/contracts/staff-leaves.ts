export const staffLeaveTypeLabels = {
  PAID: "Nghỉ phép",
  UNPAID: "Nghỉ không lương",
  SICK: "Nghỉ bệnh",
  OTHER: "Khác"
} as const

export const staffLeaveStatusLabels = {
  PENDING: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Từ chối",
  CANCELED: "Đã hủy"
} as const

export type StaffLeaveTypeKey = keyof typeof staffLeaveTypeLabels
export type StaffLeaveStatusKey = keyof typeof staffLeaveStatusLabels

export type StaffLeaveRequestItem = {
  id: string
  staffId: string
  staffName: string
  staffRole: string
  startDate: string
  endDate: string
  type: StaffLeaveTypeKey
  reason: string
  status: StaffLeaveStatusKey
  adminNote?: string
  reviewedByName?: string
  reviewedAt?: string
  createdAt: string
}

export type StaffLeaveImpactedSessionItem = {
  id: string
  classId: string
  className: string
  courseName: string
  date: string
  startTime: string
  endTime: string
  room?: string
  primaryTeacherName: string
  substituteTeacherName?: string
  impactRole: "PRIMARY" | "SUBSTITUTE"
  status: string
}
