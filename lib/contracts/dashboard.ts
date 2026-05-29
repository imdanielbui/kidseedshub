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

export type DashboardAlerts = {
  sessionsLow: LowSessionAlert[]
  staleTrialLeads: StaleTrialLeadAlert[]
  dueTasks: DueTaskAlert[]
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
  }
] as const satisfies Array<{
  key: keyof DashboardAlerts
  title: string
  emptyText: string
}>
