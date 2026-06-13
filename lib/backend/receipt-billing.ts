import type { Prisma } from "@prisma/client"
import { parseMonth } from "@/lib/backend/date"

type BillingDb = Pick<Prisma.TransactionClient, "classStudent">

type BillingPeriodInput = {
  start?: string
  end?: string
  label?: string
}

type EnrollmentBillingInput = {
  id: string
  studentId: string
  courseId: string
  startDate?: Date | null
}

export function billingMonthRange(month: string) {
  return parseMonth(month)
}

export function billingMonthLabel(month: string) {
  const [year, value] = month.split("-").map(Number)
  if (!year || !value) return month
  return `Học phí tháng ${String(value).padStart(2, "0")}/${year}`
}

export function parseBillingPeriod(input: BillingPeriodInput) {
  if (!input.start || !input.end) {
    return {
      start: undefined,
      end: undefined,
      label: input.label?.trim() || undefined
    }
  }

  const start = new Date(input.start)
  const end = new Date(input.end)

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    throw new Error("INVALID_BILLING_PERIOD")
  }

  return {
    start,
    end,
    label: input.label?.trim() || billingLabelFromDates(start, end)
  }
}

export function billingLabelFromDates(start: Date, end: Date) {
  const displayEnd = new Date(end)
  displayEnd.setUTCDate(displayEnd.getUTCDate() - 1)
  const sameMonth = start.getUTCFullYear() === displayEnd.getUTCFullYear() && start.getUTCMonth() === displayEnd.getUTCMonth()

  if (sameMonth) {
    return billingMonthLabel(`${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`)
  }

  const format = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" })
  return `Học phí ${format.format(start)} - ${format.format(displayEnd)}`
}

export async function countBillingPeriodSessions(tx: BillingDb, enrollment: EnrollmentBillingInput, period: { start?: Date; end?: Date }) {
  if (!period.start || !period.end) return undefined

  const classStudent = await tx.classStudent.findFirst({
    where: {
      studentId: enrollment.studentId,
      isActive: true,
      class: {
        courseId: enrollment.courseId,
        isActive: true
      }
    },
    include: {
      class: {
        include: {
          sessions: {
            where: {
              date: { gte: period.start, lt: period.end },
              status: { not: "CANCELED" }
            },
            select: { date: true },
            orderBy: { date: "asc" }
          }
        }
      }
    }
  })

  if (!classStudent) return undefined

  const startGate = enrollment.startDate && enrollment.startDate > period.start ? enrollment.startDate : period.start
  return classStudent.class.sessions.filter((session) => session.date >= startGate).length
}

export function billingPeriodWhere(month?: string): Prisma.ReceiptLineWhereInput | undefined {
  if (!month) return undefined
  const range = billingMonthRange(month)

  return {
    billingPeriodStart: {
      gte: range.start,
      lt: range.end
    }
  }
}
