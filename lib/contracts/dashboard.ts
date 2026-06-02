import type { MakeupEntitlementStatusKey } from "@/lib/contracts/makeup-entitlements"

export type LowSessionAlert = {
  enrollmentId: string
  studentName: string
  courseName: string
  sessionsRemaining: number
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
