import type { EmploymentTypeKey } from "@/lib/contracts/staff-profiles"

export type StaffLeaveBalanceItem = {
  staffId: string
  staffName: string
  staffRole: string
  employmentType: EmploymentTypeKey
  startDate: string
  asOfDate: string
  accruedPaidLeaveDays: string
  approvedPaidLeaveDays: string
  approvedUnpaidLeaveDays: string
  adjustmentDays: string
  availablePaidLeaveDays: string
}

export type StaffLeaveBalanceAdjustmentItem = {
  id: string
  staffId: string
  staffName: string
  days: string
  reason: string
  createdByName: string
  createdAt: string
}
