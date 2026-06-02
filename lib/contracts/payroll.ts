import type { EmploymentTypeKey } from "@/lib/contracts/staff-profiles"

export const payrollRunStatusLabels = {
  DRAFT: "Bản nháp",
  APPROVED: "Đã duyệt",
  PAID: "Đã chi",
  CANCELED: "Đã hủy"
} as const

export type PayrollRunStatusKey = keyof typeof payrollRunStatusLabels

export type PayrollLineItem = {
  id: string
  staffId: string
  staffName: string
  staffRole: string
  employmentType: EmploymentTypeKey
  baseSalary: string
  hourlyRate: string
  hoursWorked: string
  grossAmount: string
  deductions: string
  adjustments: string
  finalAmount: string
  note?: string
}

export type PayrollRunItem = {
  id: string
  month: string
  status: PayrollRunStatusKey
  generatedByName: string
  approvedByName?: string
  approvedAt?: string
  paidByName?: string
  paidAt?: string
  salaryExpenseId?: string
  salaryExpenseCode?: string
  salaryExpenseAmount?: string
  totalGrossAmount: string
  totalDeductions: string
  totalAdjustments: string
  totalFinalAmount: string
  lineCount: number
  lines: PayrollLineItem[]
  createdAt: string
  updatedAt: string
}
