import type { MakeupEntitlementStatusKey } from "@/lib/contracts/makeup-entitlements"

export type SaleKpiRow = {
  userId: string
  saleName: string
  leadCount: number
  convertedCount: number
  conversionRate: number
  revenue: string
  receiptCount: number
  averageDaysToClose: number
  openTaskCount: number
  doneTaskCount: number
}

export type SaleKpiReport = {
  month: string
  rows: SaleKpiRow[]
  totals: {
    leadCount: number
    convertedCount: number
    conversionRate: number
    revenue: string
    receiptCount: number
    openTaskCount: number
    doneTaskCount: number
  }
}

export type LeadSourceAnalyticsRow = {
  source: string
  leadCount: number
  convertedCount: number
  conversionRate: number
}

export type SaleRevenueRow = {
  userId: string
  saleName: string
  revenue: string
  receiptCount: number
}

export type RetentionRow = {
  courseId: string
  courseName: string
  activeEnrollmentCount: number
  renewedEnrollmentCount: number
  retentionRate: number
}

export type OperationsOverview = {
  scheduledClassCount: number
  completedClassCount: number
  activeStudentCount: number
  inactiveStudentCount: number
  presentCount: number
  absentCount: number
  absenceRate: number
}

export type RevenueForecast = {
  activeEnrollmentCount: number
  lowSessionEnrollmentCount: number
  averageRemainingSessions: number
  projectedRenewalRevenue: string
}

export type MakeupEntitlementReportRow = {
  entitlementId: string
  studentName: string
  courseName: string
  status: MakeupEntitlementStatusKey
  month: string
  scheduledFor?: string
  resolvedAmount?: string
  walletCreditAmount: string
  refundExpenseCode?: string
  updatedAt: string
}

export type MakeupEntitlementOperationsReport = {
  pendingScheduleCount: number
  scheduledCount: number
  completedCount: number
  creditedCount: number
  refundedCount: number
  expiredCount: number
  rejectedCount: number
  totalWalletCreditAmount: string
  totalRefundAmount: string
  rows: MakeupEntitlementReportRow[]
}

export type AdvancedAnalyticsReport = {
  month: string
  leadSources: LeadSourceAnalyticsRow[]
  saleRevenue: SaleRevenueRow[]
  retention: RetentionRow[]
  operations: OperationsOverview
  forecast: RevenueForecast
  makeupEntitlements: MakeupEntitlementOperationsReport
}
