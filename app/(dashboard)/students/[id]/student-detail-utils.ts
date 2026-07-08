import { assessmentStatusLabels } from "@/lib/contracts/assessment"
import { attendanceStatusLabels } from "@/lib/contracts/classes"
import { contactResultLabels, type ContactResultKey } from "@/lib/contracts/crm"
import type { ClassListItem } from "@/lib/contracts/courses"
import { paymentMethodLabels, type PaymentMethodKey, type ReceiptListItem } from "@/lib/contracts/finance"
import { studentStatusLabels, type StudentDetail, type StudentStatusKey } from "@/lib/contracts/students"

export type DetailTab = "overview" | "crm" | "learning" | "finance" | "journal" | "parent-account"
export type ParentAccountAction = "activate" | "reset_default_password"
export type PhotoReviewFilter = "ALL" | "DRAFT" | "PUBLISHED"
export type ReceiptBillingMode = "COURSE" | "MONTHLY"

export type ReceiptDraftLine = {
  enrollmentId: string
  freeTrialSessions: string
  paidSessionsBeforeReceipt: string
  billableSessions: string
  isBillableOverride: boolean
  discountInput: string
  extraDiscountInput: string
  isExtraDiscountVisible: boolean
}

export type ReceiptExtraDraftLine = {
  id: string
  type: "TUTORING" | "OTHER"
  description: string
  quantity: string
  unitPrice: string
  note: string
}

export type EnrollmentEditDraft = {
  enrollmentId: string
  classId: string
  startDate: string
  joinSessionNumber: string
  freeTrialSessions: string
  sessionsBought: string
  sessionsUsed: string
  isActive: boolean
}

export type EnrollmentTransferDraft = {
  fromEnrollmentId: string
  toCourseId: string
  toClassId: string
  startDate: string
  reason: string
}

export type LearningDetailTarget =
  | { kind: "course"; course: StudentDetail["courses"][number] }
  | { kind: "class"; klass: StudentDetail["classes"][number] }

export type BillingMonthOption = {
  value: string
  month: string
  year: string
  label: string
}

export const contactResults = Object.entries(contactResultLabels) as Array<[ContactResultKey, string]>
export const paymentMethods = Object.entries(paymentMethodLabels) as Array<[PaymentMethodKey, string]>
export const studentStatusOptions = Object.entries(studentStatusLabels) as Array<[StudentStatusKey, string]>
export const usesTemporaryParentPassword = process.env.NODE_ENV === "production"

export const detailTabs: Array<{ key: DetailTab; label: string }> = [
  { key: "overview", label: "Tổng quan" },
  { key: "crm", label: "CRM" },
  { key: "learning", label: "Học tập" },
  { key: "finance", label: "Tài chính" },
  { key: "journal", label: "Ảnh & nhật ký" },
  { key: "parent-account", label: "Tài khoản PH" }
]

export const photoReviewFilters: Array<{ key: PhotoReviewFilter; label: string }> = [
  { key: "ALL", label: "Tất cả" },
  { key: "DRAFT", label: "Nháp" },
  { key: "PUBLISHED", label: "Đã gửi" }
]

export function getCurrentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

export function normalizeMonth(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : getCurrentMonth()
}

export const billingMonthChoices = Array.from({ length: 12 }, (_, index) => {
  const value = String(index + 1).padStart(2, "0")

  return { value, label: `Tháng ${value}` }
})

export function getMonthPart(value: string) {
  const monthPart = value.split("-")[1] ?? "01"

  return billingMonthChoices.some((choice) => choice.value === monthPart) ? monthPart : "01"
}

export function getYearPart(value: string) {
  const yearPart = value.split("-")[0] ?? ""

  return /^\d{4}$/.test(yearPart) ? yearPart : String(new Date().getFullYear())
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

function getSingleCourseBillingMonthOptions(course: StudentDetail["courses"][number] | undefined, classes: ClassListItem[]) {
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

export function getCourseBillingMonthOptions(courses: StudentDetail["courses"], classes: ClassListItem[]) {
  const optionMap = new Map<string, BillingMonthOption>()

  courses.forEach((course) => {
    getSingleCourseBillingMonthOptions(course, classes).forEach((option) => optionMap.set(option.value, option))
  })

  return Array.from(optionMap.values()).sort((first, second) => first.value.localeCompare(second.value))
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

export function countCourseSessionsInBillingMonth(course: StudentDetail["courses"][number] | undefined, classes: ClassListItem[], month: string) {
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

export function countBilledSessionsForMonth(receipts: ReceiptListItem[], enrollmentId: string, month: string) {
  return receipts.reduce((total, receipt) => {
    return total + receipt.lines
      .filter((line) => line.enrollmentId === enrollmentId && line.billingPeriodStart?.startsWith(month))
      .reduce((lineTotal, line) => lineTotal + line.billableSessions, 0)
  }, 0)
}

function startOfLocalDay(value: Date) {
  const result = new Date(value)
  result.setHours(0, 0, 0, 0)
  return result
}

export function calculateClassJoinPreview(klass: ClassListItem | undefined, startDate: string, totalSessions: number) {
  if (!totalSessions) {
    return { joinSessionNumber: 1, sessionsFromJoin: 0, warning: "Chưa chọn khóa học." }
  }

  if (!klass) {
    return {
      joinSessionNumber: 1,
      sessionsFromJoin: totalSessions,
      warning: "Chưa xếp lớp nên hệ thống tạm tính từ buổi 1."
    }
  }

  const activeSessions = klass.sessionDates
    .filter((session) => session.status !== "CANCELED")
    .sort((first, second) => new Date(first.date).getTime() - new Date(second.date).getTime())

  if (!activeSessions.length || !startDate) {
    return {
      joinSessionNumber: 1,
      sessionsFromJoin: totalSessions,
      warning: "Lớp chưa có lịch học đã sinh, hệ thống sẽ fallback từ buổi 1."
    }
  }

  const start = startOfLocalDay(new Date(`${startDate}T00:00:00`)).getTime()
  const index = activeSessions.findIndex((session) => startOfLocalDay(new Date(session.date)).getTime() >= start)
  const joinSessionNumber = index === -1 ? activeSessions.length + 1 : index + 1

  return {
    joinSessionNumber,
    sessionsFromJoin: Math.max(0, totalSessions - joinSessionNumber + 1),
    warning: undefined
  }
}

export function toReceiptDraftLine(course: StudentDetail["courses"][number]): ReceiptDraftLine {
  return {
    enrollmentId: course.enrollmentId,
    freeTrialSessions: String(course.freeTrialSessions),
    paidSessionsBeforeReceipt: String(course.paidSessionsBeforeReceipt),
    billableSessions: "",
    isBillableOverride: false,
    discountInput: "",
    extraDiscountInput: "",
    isExtraDiscountVisible: false
  }
}

export function toEnrollmentEditDraft(course: StudentDetail["courses"][number]): EnrollmentEditDraft {
  return {
    enrollmentId: course.enrollmentId,
    classId: course.classId ?? "",
    startDate: course.startDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    joinSessionNumber: String(course.joinSessionNumber ?? 1),
    freeTrialSessions: String(course.freeTrialSessions),
    sessionsBought: String(course.sessionsBought),
    sessionsUsed: String(course.sessionsUsed),
    isActive: course.isActive
  }
}

export function activeStudentCourses(student: StudentDetail) {
  return student.courses.filter((course) => course.isActive)
}

export function timelineTypeLabel(type: StudentDetail["learningTimeline"][number]["type"]) {
  switch (type) {
    case "attendance":
      return "Điểm danh"
    case "photo":
      return "Ảnh"
    case "weekly_assessment":
      return "Weekly"
    case "final_assessment":
      return "Cuối khóa"
    case "course":
    default:
      return "Khóa học"
  }
}

export function timelineStatusLabel(item: StudentDetail["learningTimeline"][number]) {
  if (!item.status) return undefined
  if (item.type === "attendance") return attendanceStatusLabels[item.status as keyof typeof attendanceStatusLabels]
  if (item.type === "weekly_assessment") return assessmentStatusLabels[item.status as keyof typeof assessmentStatusLabels]
  return undefined
}

export function assessmentProgressPercent(item: StudentDetail["assessmentProgress"][number]) {
  if (!item.totalWeeks) return 0
  return Math.min(100, Math.round((item.completedWeeks / item.totalWeeks) * 100))
}
