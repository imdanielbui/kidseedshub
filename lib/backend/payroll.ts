import { Prisma } from "@prisma/client"
import { parseMonth } from "@/lib/backend/date"
import type { PayrollLineItem, PayrollRunItem } from "@/lib/contracts/payroll"

export const payrollRunInclude = Prisma.validator<Prisma.PayrollRunInclude>()({
  generatedBy: true,
  approvedBy: true,
  paidBy: true,
  salaryExpense: true,
  lines: {
    include: {
      staff: true
    }
  }
})

export type PayrollRunRecord = Prisma.PayrollRunGetPayload<{ include: typeof payrollRunInclude }>

const monthlyWorkingDays = new Prisma.Decimal(26)

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function inclusiveOverlapDays(startDate: Date, endDate: Date, rangeStart: Date, rangeEndExclusive: Date) {
  const start = Math.max(startOfUtcDay(startDate).getTime(), startOfUtcDay(rangeStart).getTime())
  const end = Math.min(startOfUtcDay(endDate).getTime(), startOfUtcDay(new Date(rangeEndExclusive.getTime() - 1)).getTime())

  if (end < start) {
    return new Prisma.Decimal(0)
  }

  return new Prisma.Decimal(Math.floor((end - start) / 86_400_000) + 1)
}

function sumDecimals(values: Prisma.Decimal[]) {
  return values.reduce((total, value) => total.plus(value), new Prisma.Decimal(0))
}

function nonNegative(value: Prisma.Decimal) {
  return value.lessThan(0) ? new Prisma.Decimal(0) : value
}

function toLineItem(line: PayrollRunRecord["lines"][number]): PayrollLineItem {
  return {
    id: line.id,
    staffId: line.staffId,
    staffName: line.staff.name,
    staffRole: line.staff.role,
    employmentType: line.employmentType,
    baseSalary: line.baseSalary.toString(),
    hourlyRate: line.hourlyRate.toString(),
    hoursWorked: line.hoursWorked.toString(),
    grossAmount: line.grossAmount.toString(),
    deductions: line.deductions.toString(),
    adjustments: line.adjustments.toString(),
    finalAmount: line.finalAmount.toString(),
    note: line.note ?? undefined
  }
}

export function toPayrollRunItem(run: PayrollRunRecord): PayrollRunItem {
  const sortedLines = [...run.lines].sort((first, second) => first.staff.name.localeCompare(second.staff.name))
  const totalGrossAmount = sumDecimals(sortedLines.map((line) => line.grossAmount))
  const totalDeductions = sumDecimals(sortedLines.map((line) => line.deductions))
  const totalAdjustments = sumDecimals(sortedLines.map((line) => line.adjustments))
  const totalFinalAmount = sumDecimals(sortedLines.map((line) => line.finalAmount))

  return {
    id: run.id,
    month: run.month,
    status: run.status,
    generatedByName: run.generatedBy.name,
    approvedByName: run.approvedBy?.name,
    approvedAt: run.approvedAt?.toISOString(),
    paidByName: run.paidBy?.name,
    paidAt: run.paidAt?.toISOString(),
    salaryExpenseId: run.salaryExpense?.id,
    salaryExpenseCode: run.salaryExpense?.code,
    salaryExpenseAmount: run.salaryExpense?.amount.toString(),
    totalGrossAmount: totalGrossAmount.toString(),
    totalDeductions: totalDeductions.toString(),
    totalAdjustments: totalAdjustments.toString(),
    totalFinalAmount: totalFinalAmount.toString(),
    lineCount: sortedLines.length,
    lines: sortedLines.map(toLineItem),
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString()
  }
}

export function recalculatePayrollLine(input: {
  baseSalary: Prisma.Decimal
  hourlyRate: Prisma.Decimal
  hoursWorked: Prisma.Decimal
  deductions: Prisma.Decimal
  adjustments: Prisma.Decimal
  finalAmountOverride?: Prisma.Decimal
}) {
  const grossAmount = input.baseSalary.greaterThan(0)
    ? input.baseSalary
    : input.hoursWorked.mul(input.hourlyRate).toDecimalPlaces(2)
  const finalAmount = input.finalAmountOverride ?? nonNegative(grossAmount.minus(input.deductions).plus(input.adjustments))

  return {
    grossAmount,
    finalAmount
  }
}

export async function generatePayrollLines(tx: Prisma.TransactionClient, run: { id: string; month: string }) {
  const range = parseMonth(run.month)
  const profiles = await tx.staffProfile.findMany({
    where: {
      payrollActive: true,
      startDate: { lt: range.end },
      user: {
        isActive: true,
        role: { in: ["ADMIN", "SALE", "TEACHER"] }
      }
    },
    include: {
      user: true
    }
  })
  const staffIds = profiles.map((profile) => profile.userId)
  const [approvedTimesheets, unpaidLeaves] = await Promise.all([
    tx.staffTimesheetEntry.findMany({
      where: {
        staffId: { in: staffIds },
        status: "APPROVED",
        date: {
          gte: range.start,
          lt: range.end
        }
      },
      select: {
        staffId: true,
        hours: true
      }
    }),
    tx.staffLeaveRequest.findMany({
      where: {
        staffId: { in: staffIds },
        status: "APPROVED",
        type: "UNPAID",
        startDate: { lt: range.end },
        endDate: { gte: range.start }
      },
      select: {
        staffId: true,
        startDate: true,
        endDate: true
      }
    })
  ])

  await tx.payrollLine.deleteMany({
    where: { payrollRunId: run.id }
  })

  if (!profiles.length) {
    return { count: 0 }
  }

  return tx.payrollLine.createMany({
    data: profiles.map((profile) => {
      const baseSalary = profile.employmentType === "FULL_TIME" ? profile.monthlySalary ?? new Prisma.Decimal(0) : new Prisma.Decimal(0)
      const hourlyRate = profile.employmentType === "PART_TIME" ? profile.hourlyRate ?? new Prisma.Decimal(0) : new Prisma.Decimal(0)
      const hoursWorked = sumDecimals(
        approvedTimesheets
          .filter((timesheet) => timesheet.staffId === profile.userId)
          .map((timesheet) => timesheet.hours)
      )
      const unpaidLeaveDays = sumDecimals(
        unpaidLeaves
          .filter((leave) => leave.staffId === profile.userId)
          .map((leave) => inclusiveOverlapDays(leave.startDate, leave.endDate, range.start, range.end))
      )
      const deductions = profile.employmentType === "FULL_TIME" && baseSalary.greaterThan(0)
        ? baseSalary.div(monthlyWorkingDays).mul(unpaidLeaveDays).toDecimalPlaces(2)
        : new Prisma.Decimal(0)
      const { grossAmount, finalAmount } = recalculatePayrollLine({
        baseSalary,
        hourlyRate,
        hoursWorked,
        deductions,
        adjustments: new Prisma.Decimal(0)
      })

      return {
        payrollRunId: run.id,
        staffId: profile.userId,
        employmentType: profile.employmentType,
        baseSalary,
        hourlyRate,
        hoursWorked,
        grossAmount,
        deductions,
        adjustments: new Prisma.Decimal(0),
        finalAmount,
        note: profile.employmentType === "FULL_TIME" && unpaidLeaveDays.greaterThan(0)
          ? `Khấu trừ ${unpaidLeaveDays.toString()} ngày nghỉ không lương; công chuẩn 26 ngày/tháng`
          : null
      }
    })
  })
}
