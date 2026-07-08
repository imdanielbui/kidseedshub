import type { ExpenseCategoryKey, PaymentMethodKey, ReceiptListItem } from "@/lib/contracts/finance"
import type { ClassListItem } from "@/lib/contracts/courses"
import type { StudentListItem } from "@/lib/contracts/students"

export type FinanceRole = "ADMIN" | "SALE" | "TEACHER" | "PARENT"
export type FinanceTab = "overview" | "receipts" | "expenses" | "payroll" | "reminders"
export type FinanceDialog = "receipt" | "expense" | null
export type ReceiptBillingMode = "COURSE" | "MONTHLY"

export type SessionPayload = {
  user?: {
    role?: FinanceRole
  }
} | null

export type ReceiptFormState = {
  enrollmentId: string
  billingMode: ReceiptBillingMode
  billingMonth: string
  billableSessions: string
  method: PaymentMethodKey
  note: string
}

export type ExpenseFormState = {
  category: ExpenseCategoryKey
  amount: string
  description: string
  invoiceUrl: string
  date: string
}

export type PayrollLineEditState = {
  hoursWorked: string
  deductions: string
  adjustments: string
  note: string
}

export type BillingMonthOption = {
  value: string
  month: string
  year: string
  label: string
}

export function getCurrentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

export function normalizeMonth(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : getCurrentMonth()
}

export const financeMonthChoices = Array.from({ length: 12 }, (_, index) => {
  const value = String(index + 1).padStart(2, "0")

  return { value, label: `Tháng ${value}` }
})

const financeYearStart = 2020
const financeYearLookahead = 20

export const emptyReceiptForm: ReceiptFormState = {
  enrollmentId: "",
  billingMode: "COURSE",
  billingMonth: getCurrentMonth(),
  billableSessions: "",
  method: "BANK_TRANSFER",
  note: ""
}

export const emptyExpenseForm: ExpenseFormState = {
  category: "MATERIALS",
  amount: "",
  description: "",
  invoiceUrl: "",
  date: new Date().toISOString().slice(0, 10)
}

export function getMonthPart(value: string) {
  const monthPart = value.split("-")[1] ?? "01"

  return financeMonthChoices.some((choice) => choice.value === monthPart) ? monthPart : "01"
}

export function getYearPart(value: string) {
  const yearPart = value.split("-")[0] ?? ""

  return /^\d{4}$/.test(yearPart) ? yearPart : String(new Date().getFullYear())
}

export function buildYearOptions(selectedYear: string) {
  const currentYear = new Date().getFullYear()
  const selectedYearNumber = Number(selectedYear)
  const firstYear = Math.min(financeYearStart, selectedYearNumber)
  const lastYear = Math.max(currentYear + financeYearLookahead, selectedYearNumber)

  return Array.from({ length: lastYear - firstYear + 1 }, (_, index) => String(lastYear - index))
}

function toValidDate(value?: string) {
  if (!value) return undefined
  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? undefined : date
}

function toBillingMonthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
}

function toBillingMonthOption(monthKey: string): BillingMonthOption {
  const [year, month] = monthKey.split("-")

  return { value: monthKey, month, year, label: `Tháng ${month}` }
}

export function getCourseBillingMonthOptions(course: StudentListItem["courses"][number] | undefined, classes: ClassListItem[]) {
  if (!course) return []
  const klass = course.classId ? classes.find((item) => item.id === course.classId) : undefined
  const sessionDates = (klass?.sessionDates ?? [])
    .map((session) => toValidDate(session.date))
    .filter((date): date is Date => Boolean(date))
    .sort((first, second) => first.getTime() - second.getTime())
  const firstSessionDate = sessionDates[0]
  const lastSessionDate = sessionDates[sessionDates.length - 1]
  const startDate = toValidDate(course.startDate) ?? firstSessionDate ?? toValidDate(klass?.startDate)

  if (!startDate) return []

  const endDate = toValidDate(course.endDate) ?? lastSessionDate ?? startDate
  const startMonth = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1))
  const endMonthSource = endDate < startDate ? startDate : endDate
  const endMonth = new Date(Date.UTC(endMonthSource.getUTCFullYear(), endMonthSource.getUTCMonth(), 1))
  const options: BillingMonthOption[] = []

  for (let cursor = new Date(startMonth); cursor <= endMonth && options.length < 120; cursor.setUTCMonth(cursor.getUTCMonth() + 1)) {
    options.push(toBillingMonthOption(toBillingMonthKey(cursor)))
  }

  return options
}

export function getBillingMonthInRange(month: string, options: BillingMonthOption[]) {
  const normalizedMonth = normalizeMonth(month)

  if (!options.length) return normalizedMonth
  return options.some((option) => option.value === normalizedMonth) ? normalizedMonth : options[0].value
}

export function getBillingYearOptions(options: BillingMonthOption[], activeMonth: string) {
  const years = Array.from(new Set(options.map((option) => option.year)))

  return years.includes(getYearPart(activeMonth)) ? years : years.slice(0, 1)
}

export function getBillingMonthChoicesForYear(options: BillingMonthOption[], year: string) {
  return options.filter((option) => option.year === year)
}

export function formatMoney(value: string) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0
  }).format(Number(value))
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(value))
}

export function getReceiptTotal(receipts: ReceiptListItem[]) {
  return receipts.reduce((total, receipt) => total + Number(receipt.amount), 0)
}

export function getBillingPeriodForMonth(month: string) {
  const normalizedMonth = normalizeMonth(month)
  const [year, value] = normalizedMonth.split("-").map(Number)
  const start = new Date(Date.UTC(year, value - 1, 1))
  const end = new Date(Date.UTC(year, value, 1))

  return {
    start,
    end,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    label: `Học phí tháng ${String(value).padStart(2, "0")}/${year}`
  }
}

export function countCourseSessionsInBillingMonth(course: StudentListItem["courses"][number] | undefined, classes: ClassListItem[], month: string) {
  if (!course?.classId) return undefined
  const klass = classes.find((item) => item.id === course.classId)
  if (!klass) return undefined
  const period = getBillingPeriodForMonth(month)
  const startGate = course.startDate && new Date(course.startDate) > period.start ? new Date(course.startDate) : period.start

  return klass.sessionDates.filter((session) => {
    const sessionDate = new Date(session.date)
    return session.status !== "CANCELED" && sessionDate >= startGate && sessionDate < period.end
  }).length
}
