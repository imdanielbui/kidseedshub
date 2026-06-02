export const makeupEntitlementStatusLabels = {
  PENDING_SCHEDULE: "Chờ xếp lịch",
  SCHEDULED: "Đã xếp lịch",
  COMPLETED: "Đã học bù",
  CREDITED: "Đã chuyển credit",
  REFUNDED: "Đã hoàn tiền",
  EXPIRED: "Hết hạn",
  REJECTED: "Không đủ điều kiện"
} as const

export type MakeupEntitlementStatusKey = keyof typeof makeupEntitlementStatusLabels

export type MakeupEntitlementItem = {
  id: string
  studentId: string
  studentCode: string
  studentName: string
  parentName: string
  enrollmentId: string
  courseName: string
  attendanceId?: string
  absenceRequestId?: string
  classSessionId?: string
  className?: string
  sessionDate?: string
  month: string
  status: MakeupEntitlementStatusKey
  isEligible: boolean
  eligibilityReason?: string
  scheduledFor?: string
  resolvedAmount?: string
  resolvedByName?: string
  resolvedAt?: string
  note?: string
  walletCreditAmount: string
  refundExpenseCode?: string
  createdAt: string
  updatedAt: string
}
