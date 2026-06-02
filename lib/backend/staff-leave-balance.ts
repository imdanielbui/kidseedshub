import { Prisma } from "@prisma/client"
import { dateKey } from "@/lib/backend/class-schedule"
import type { StaffLeaveBalanceAdjustmentItem, StaffLeaveBalanceItem } from "@/lib/contracts/staff-leave-balances"

export const staffLeaveBalanceAdjustmentInclude = Prisma.validator<Prisma.StaffLeaveBalanceAdjustmentInclude>()({
  staff: true,
  createdBy: true
})

export type StaffLeaveBalanceAdjustmentRecord = Prisma.StaffLeaveBalanceAdjustmentGetPayload<{
  include: typeof staffLeaveBalanceAdjustmentInclude
}>

type StaffProfileForBalance = {
  userId: string
  employmentType: "FULL_TIME" | "PART_TIME"
  startDate: Date
  user: {
    name: string
    role: string
  }
}

type LeaveRequestForBalance = {
  startDate: Date
  endDate: Date
  type: "PAID" | "UNPAID" | "SICK" | "OTHER"
}

type AdjustmentForBalance = {
  days: Prisma.Decimal
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function inclusiveDays(startDate: Date, endDate: Date) {
  const start = startOfUtcDay(startDate).getTime()
  const end = startOfUtcDay(endDate).getTime()

  if (end < start) {
    return new Prisma.Decimal(0)
  }

  return new Prisma.Decimal(Math.floor((end - start) / 86_400_000) + 1)
}

function completedWorkingMonths(startDate: Date, asOfDate: Date) {
  const start = startOfUtcDay(startDate)
  const asOf = startOfUtcDay(asOfDate)

  if (asOf < start) {
    return 0
  }

  let months = (asOf.getUTCFullYear() - start.getUTCFullYear()) * 12 + asOf.getUTCMonth() - start.getUTCMonth()

  if (asOf.getUTCDate() < start.getUTCDate()) {
    months -= 1
  }

  return Math.max(0, months)
}

export function calculateStaffLeaveBalance(input: {
  profile: StaffProfileForBalance
  approvedLeaves: LeaveRequestForBalance[]
  adjustments: AdjustmentForBalance[]
  asOfDate: Date
}): StaffLeaveBalanceItem {
  const accruedPaidLeaveDays =
    input.profile.employmentType === "FULL_TIME"
      ? new Prisma.Decimal(completedWorkingMonths(input.profile.startDate, input.asOfDate))
      : new Prisma.Decimal(0)
  const approvedPaidLeaveDays = input.approvedLeaves
    .filter((leave) => leave.type === "PAID")
    .reduce((total, leave) => total.plus(inclusiveDays(leave.startDate, leave.endDate)), new Prisma.Decimal(0))
  const approvedUnpaidLeaveDays = input.approvedLeaves
    .filter((leave) => leave.type === "UNPAID")
    .reduce((total, leave) => total.plus(inclusiveDays(leave.startDate, leave.endDate)), new Prisma.Decimal(0))
  const adjustmentDays = input.adjustments.reduce((total, adjustment) => total.plus(adjustment.days), new Prisma.Decimal(0))
  const availablePaidLeaveDays = accruedPaidLeaveDays.minus(approvedPaidLeaveDays).plus(adjustmentDays)

  return {
    staffId: input.profile.userId,
    staffName: input.profile.user.name,
    staffRole: input.profile.user.role,
    employmentType: input.profile.employmentType,
    startDate: dateKey(input.profile.startDate),
    asOfDate: dateKey(input.asOfDate),
    accruedPaidLeaveDays: accruedPaidLeaveDays.toString(),
    approvedPaidLeaveDays: approvedPaidLeaveDays.toString(),
    approvedUnpaidLeaveDays: approvedUnpaidLeaveDays.toString(),
    adjustmentDays: adjustmentDays.toString(),
    availablePaidLeaveDays: availablePaidLeaveDays.toString()
  }
}

export function toStaffLeaveBalanceAdjustmentItem(adjustment: StaffLeaveBalanceAdjustmentRecord): StaffLeaveBalanceAdjustmentItem {
  return {
    id: adjustment.id,
    staffId: adjustment.staffId,
    staffName: adjustment.staff.name,
    days: adjustment.days.toString(),
    reason: adjustment.reason,
    createdByName: adjustment.createdBy.name,
    createdAt: adjustment.createdAt.toISOString()
  }
}
