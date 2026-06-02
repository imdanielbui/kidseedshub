export const staffTimesheetSourceLabels = {
  CLASS_SESSION: "Buổi học",
  MANUAL: "Thủ công",
  ADJUSTMENT: "Điều chỉnh"
} as const

export const staffTimesheetStatusLabels = {
  DRAFT: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Từ chối"
} as const

export type StaffTimesheetSourceKey = keyof typeof staffTimesheetSourceLabels
export type StaffTimesheetStatusKey = keyof typeof staffTimesheetStatusLabels

export type StaffTimesheetEntryItem = {
  id: string
  staffId: string
  staffName: string
  staffRole: string
  date: string
  source: StaffTimesheetSourceKey
  startTime?: string
  endTime?: string
  hours: string
  status: StaffTimesheetStatusKey
  linkedClassSessionId?: string
  className?: string
  courseName?: string
  approvedByName?: string
  approvedAt?: string
  note?: string
  createdAt: string
  updatedAt: string
}
