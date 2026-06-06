import type { MakeupEntitlementStatusKey } from "@/lib/contracts/makeup-entitlements"
import type { PipelineStageCounts } from "@/lib/contracts/crm"

export type LowSessionAlert = {
  enrollmentId: string
  studentName: string
  courseName: string
  sessionsRemaining: number
}

export type DebtWarningAlert = {
  enrollmentId: string
  studentId: string
  studentName: string
  courseName: string
  sessionsRemaining: number
  latestAttendanceAt?: string
  latestReceiptAt?: string
}

export type StaleTrialLeadAlert = {
  studentId: string
  studentName: string
  parentName: string
  phone: string
  daysSinceUpdate: number
}

export type DueTaskAlert = {
  taskId: string
  title: string
  studentName?: string
  dueDate: string
}

export type MakeupEntitlementAlert = {
  entitlementId: string
  studentId: string
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

export type DashboardAlerts = {
  sessionsLow: LowSessionAlert[]
  debtWarnings: DebtWarningAlert[]
  staleTrialLeads: StaleTrialLeadAlert[]
  dueTasks: DueTaskAlert[]
  makeupStateAlerts: MakeupEntitlementAlert[]
}

export const dashboardAlertSections = [
  {
    key: "sessionsLow",
    title: "Học viên còn <= 2 buổi",
    emptyText: "Chưa có học viên sắp hết buổi."
  },
  {
    key: "debtWarnings",
    title: "Cần thu học phí",
    emptyText: "Chưa có học viên hết buổi chưa đóng mới."
  },
  {
    key: "staleTrialLeads",
    title: "Lead học thử quá 3 ngày",
    emptyText: "Chưa có lead học thử bị bỏ quên."
  },
  {
    key: "dueTasks",
    title: "Task đến hạn hôm nay",
    emptyText: "Chưa có task đến hạn hôm nay."
  },
  {
    key: "makeupStateAlerts",
    title: "Học bù, credit & refund",
    emptyText: "Chưa có trạng thái học bù/credit/refund cần theo dõi."
  }
] as const satisfies Array<{
  key: keyof DashboardAlerts
  title: string
  emptyText: string
}>

export type DashboardOverviewReceipt = {
  id: string
  code: string
  studentName: string
  parentName: string
  amount: string
  createdAt: string
}

export type DashboardOverviewClassSession = {
  id: string
  className: string
  courseName: string
  teacherName: string
  startTime: string
  endTime: string
  room?: string
  studentCount: number
  attendanceMarked: number
}

export type DashboardOverviewFollowUp = {
  id: string
  type: "TRIAL_STALE" | "TASK_DUE" | "LOW_SESSION" | "DEBT"
  title: string
  detail: string
  href?: string
  priority: "HIGH" | "MEDIUM" | "LOW"
  dueAt?: string
}

export type DashboardOverview = {
  month: string
  generatedAt: string
  finance: {
    scopeLabel: string
    revenue: string
    netRevenue: string
    expense?: string
    profit?: string
    receiptCount: number
    averageReceipt: string
    latestReceipts: DashboardOverviewReceipt[]
  } | null
  pipeline: {
    scopeLabel: string
    stageCounts: PipelineStageCounts
    leadCount: number
    trialCount: number
    evaluationCount: number
    convertedCount: number
    staleTrialCount: number
    closedThisMonth: number
    newLeadsThisMonth: number
    conversionRate: number
  } | null
  classes: {
    scopeLabel: string
    activeClassCount: number
    todaySessionCount: number
    todayStudentSlots: number
    attendanceMarked: number
    attendanceRate: number
    upcomingToday: DashboardOverviewClassSession[]
  }
  students: {
    scopeLabel: string
    activeStudentCount: number
    lowSessionCount: number
    debtWarningCount: number
  }
  followUps: DashboardOverviewFollowUp[]
}
