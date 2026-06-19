"use client"

import { ArrowLeft, BarChart3, BookOpenCheck, CalendarClock, CheckCircle2, ClipboardCheck, CreditCard, Eye, EyeOff, KeyRound, Pencil, Phone, Plus, Printer, Repeat2, RotateCcw, Save, Send, ShieldCheck, Star, Trash2, UserRound } from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import type { ApiResponse } from "@/lib/api-response"
import { DialogFormShell, DialogShell } from "@/components/shared/dialog-shell"
import { assessmentStatusLabels, subjectLabels } from "@/lib/contracts/assessment"
import { attendanceStatusLabels, type ClassPhotoListItem } from "@/lib/contracts/classes"
import { contactResultLabels, type ContactResultKey, taskStatusLabels } from "@/lib/contracts/crm"
import type { ClassListItem, CourseListItem } from "@/lib/contracts/courses"
import type { EnrollmentTransferResult } from "@/lib/contracts/enrollment-transfers"
import type { EnrollmentDeleteResult } from "@/lib/contracts/enrollments"
import { paymentMethodLabels, receiptExtraLineTypeLabels, type PaymentMethodKey, type ReceiptListItem } from "@/lib/contracts/finance"
import { makeupEntitlementStatusLabels, type MakeupEntitlementItem } from "@/lib/contracts/makeup-entitlements"
import { studentStatusLabels, type ParentAccountInfo, type StudentContactLogItem, type StudentDetail, type StudentStatusKey, type StudentTaskItem } from "@/lib/contracts/students"
import { studentWalletEntryTypeLabels, type StudentWalletSummary } from "@/lib/contracts/student-wallet"

type DetailTab = "overview" | "crm" | "learning" | "finance" | "journal" | "parent-account"
type ParentAccountAction = "activate" | "reset_default_password"
type PhotoReviewFilter = "ALL" | "DRAFT" | "PUBLISHED"
type ReceiptBillingMode = "COURSE" | "MONTHLY"
type ReceiptDraftLine = {
  enrollmentId: string
  freeTrialSessions: string
  paidSessionsBeforeReceipt: string
  billableSessions: string
  isBillableOverride: boolean
  discountInput: string
  extraDiscountInput: string
  isExtraDiscountVisible: boolean
}
type ReceiptExtraDraftLine = {
  id: string
  type: "TUTORING" | "OTHER"
  description: string
  quantity: string
  unitPrice: string
  note: string
}
type EnrollmentEditDraft = {
  enrollmentId: string
  classId: string
  startDate: string
  joinSessionNumber: string
  freeTrialSessions: string
  sessionsBought: string
  sessionsUsed: string
  isActive: boolean
}
type EnrollmentTransferDraft = {
  fromEnrollmentId: string
  toCourseId: string
  toClassId: string
  startDate: string
  reason: string
}
type LearningDetailTarget =
  | { kind: "course"; course: StudentDetail["courses"][number] }
  | { kind: "class"; klass: StudentDetail["classes"][number] }

const contactResults = Object.entries(contactResultLabels) as Array<[ContactResultKey, string]>
const paymentMethods = Object.entries(paymentMethodLabels) as Array<[PaymentMethodKey, string]>
const studentStatusOptions = Object.entries(studentStatusLabels) as Array<[StudentStatusKey, string]>
const usesTemporaryParentPassword = process.env.NODE_ENV === "production"
const detailTabs: Array<{ key: DetailTab; label: string }> = [
  { key: "overview", label: "Tổng quan" },
  { key: "crm", label: "CRM" },
  { key: "learning", label: "Học tập" },
  { key: "finance", label: "Tài chính" },
  { key: "journal", label: "Ảnh & nhật ký" },
  { key: "parent-account", label: "Tài khoản PH" }
]

const photoReviewFilters: Array<{ key: PhotoReviewFilter; label: string }> = [
  { key: "ALL", label: "Tất cả" },
  { key: "DRAFT", label: "Nháp" },
  { key: "PUBLISHED", label: "Đã gửi" }
]

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(value))
}

function formatWeekday(weekday: number) {
  return weekday === 0 ? "Chủ nhật" : `Thứ ${weekday + 1}`
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 0,
    style: "currency",
    currency: "VND"
  }).format(Number.isFinite(value) ? value : 0)
}

function toNumber(value: string) {
  const parsed = Number(value.replaceAll(",", ""))
  return Number.isFinite(parsed) ? parsed : 0
}

function toNonNegativeNumber(value: string) {
  return Math.max(0, toNumber(value))
}

function toNonNegativeIntegerInput(value: string) {
  const digits = value.replace(/[^\d]/g, "")
  return digits || "0"
}

function hasNegativeSign(value: string) {
  return value.trim().startsWith("-")
}

function parseMoneyInput(value: string) {
  const parsed = Number(value.replace(/[^\d]/g, ""))
  return Number.isFinite(parsed) ? parsed : 0
}

function formatMoneyInput(value: string | number) {
  const digits = String(value).replace(/[^\d]/g, "")
  return digits ? new Intl.NumberFormat("vi-VN").format(Number(digits)) : ""
}

function parseDiscountInput(value: string, grossAmount: number) {
  const raw = value.trim()
  if (!raw) return { discountAmount: 0, discountPercent: 0, totalDiscount: 0, label: "Không giảm" }

  if (raw.includes("%")) {
    const percent = Number(raw.replace("%", "").replace(",", ".").replace(/[^\d.-]/g, "").trim())
    const discountPercent = Number.isFinite(percent) ? Math.min(Math.max(percent, 0), 100) : 0
    const totalDiscount = grossAmount * discountPercent / 100
    return { discountAmount: 0, discountPercent, totalDiscount, label: `Giảm ${discountPercent}% = ${formatCurrency(totalDiscount)}` }
  }

  const numericValue = parseMoneyInput(raw)
  if (numericValue <= 100) {
    const totalDiscount = grossAmount * numericValue / 100
    return { discountAmount: 0, discountPercent: numericValue, totalDiscount, label: `Giảm ${numericValue}% = ${formatCurrency(totalDiscount)}` }
  }

  const discountAmount = parseMoneyInput(raw)
  return { discountAmount, discountPercent: 0, totalDiscount: discountAmount, label: `Giảm ${formatCurrency(discountAmount)}` }
}

function parseDiscountInputs(values: string[], grossAmount: number) {
  const parsedItems = values.map((value) => parseDiscountInput(value, grossAmount))
  const discountAmount = parsedItems.reduce((total, item) => total + item.discountAmount, 0)
  const discountPercent = Math.min(100, parsedItems.reduce((total, item) => total + item.discountPercent, 0))
  const percentDiscount = grossAmount * discountPercent / 100
  const totalDiscount = discountAmount + percentDiscount
  const labelParts = []

  if (discountPercent > 0) labelParts.push(`${discountPercent}%`)
  if (discountAmount > 0) labelParts.push(`${formatMoneyInput(Math.round(discountAmount))}đ`)

  return {
    discountAmount,
    discountPercent,
    totalDiscount,
    label: labelParts.length ? `Giảm ${labelParts.join(" + ")} = ${formatCurrency(totalDiscount)}` : "Không giảm"
  }
}

function formatDiscountInput(value: string) {
  const raw = value.trim()
  if (!raw) return ""
  const numericValue = parseMoneyInput(raw)

  if (raw.includes("%") || numericValue <= 100) {
    return `${Math.min(Math.max(numericValue, 0), 100)}%`
  }

  return `${formatMoneyInput(numericValue)}đ`
}

function moneySuggestions(value: string) {
  const digits = value.replace(/[^\d]/g, "")
  if (!digits || digits.length > 3) return []

  const base = Number(digits)
  if (!Number.isFinite(base) || base <= 0) return []

  return [base * 10000, base * 100000]
}

function getCurrentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

function normalizeMonth(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : getCurrentMonth()
}

const billingMonthChoices = Array.from({ length: 12 }, (_, index) => {
  const value = String(index + 1).padStart(2, "0")

  return { value, label: `Tháng ${value}` }
})

function getMonthPart(value: string) {
  const monthPart = value.split("-")[1] ?? "01"

  return billingMonthChoices.some((choice) => choice.value === monthPart) ? monthPart : "01"
}

function getYearPart(value: string) {
  const yearPart = value.split("-")[0] ?? ""

  return /^\d{4}$/.test(yearPart) ? yearPart : String(new Date().getFullYear())
}

function buildYearOptions(selectedYear: string) {
  const currentYear = new Date().getFullYear()
  const selectedYearNumber = Number(selectedYear)
  const firstYear = Math.min(2020, selectedYearNumber)
  const lastYear = Math.max(currentYear + 20, selectedYearNumber)

  return Array.from({ length: lastYear - firstYear + 1 }, (_, index) => String(lastYear - index))
}

function getBillingPeriodForMonth(month: string) {
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

function countCourseSessionsInBillingMonth(course: StudentDetail["courses"][number] | undefined, classes: ClassListItem[], month: string) {
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

function countBilledSessionsForMonth(receipts: ReceiptListItem[], enrollmentId: string, month: string) {
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

function calculateClassJoinPreview(klass: ClassListItem | undefined, startDate: string, totalSessions: number) {
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

function toReceiptDraftLine(course: StudentDetail["courses"][number]): ReceiptDraftLine {
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

function toEnrollmentEditDraft(course: StudentDetail["courses"][number]): EnrollmentEditDraft {
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

function activeStudentCourses(student: StudentDetail) {
  return student.courses.filter((course) => course.isActive)
}

function timelineTypeLabel(type: StudentDetail["learningTimeline"][number]["type"]) {
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

function timelineStatusLabel(item: StudentDetail["learningTimeline"][number]) {
  if (!item.status) return undefined
  if (item.type === "attendance") return attendanceStatusLabels[item.status as keyof typeof attendanceStatusLabels]
  if (item.type === "weekly_assessment") return assessmentStatusLabels[item.status as keyof typeof assessmentStatusLabels]
  return undefined
}

function assessmentProgressPercent(item: StudentDetail["assessmentProgress"][number]) {
  if (!item.totalWeeks) return 0
  return Math.min(100, Math.round((item.completedWeeks / item.totalWeeks) * 100))
}

export function StudentDetailClient({ studentId }: { studentId: string }) {
  const [student, setStudent] = useState<StudentDetail | null>(null)
  const [courses, setCourses] = useState<CourseListItem[]>([])
  const [classes, setClasses] = useState<ClassListItem[]>([])
  const [activeTab, setActiveTab] = useState<DetailTab>("overview")
  const [profileName, setProfileName] = useState("")
  const [profileBirthDate, setProfileBirthDate] = useState("")
  const [profileStatus, setProfileStatus] = useState<StudentStatusKey>("LEAD")
  const [profileParentName, setProfileParentName] = useState("")
  const [profileParentPhone, setProfileParentPhone] = useState("")
  const [profileParentEmail, setProfileParentEmail] = useState("")
  const [profileAddress, setProfileAddress] = useState("")
  const [profileLeadSource, setProfileLeadSource] = useState("")
  const [profileLeadNote, setProfileLeadNote] = useState("")
  const [profileHealthNote, setProfileHealthNote] = useState("")
  const [content, setContent] = useState("")
  const [result, setResult] = useState<ContactResultKey>("INTERESTED")
  const [taskTitle, setTaskTitle] = useState("")
  const [taskNote, setTaskNote] = useState("")
  const [taskDueDate, setTaskDueDate] = useState(new Date().toISOString().slice(0, 10))
  const [enrollmentCourseId, setEnrollmentCourseId] = useState("")
  const [enrollmentClassId, setEnrollmentClassId] = useState("")
  const [enrollmentSessions, setEnrollmentSessions] = useState("0")
  const [enrollmentFreeTrialSessions, setEnrollmentFreeTrialSessions] = useState("0")
  const [enrollmentStartDate, setEnrollmentStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [receiptAmount, setReceiptAmount] = useState("")
	  const [receiptLines, setReceiptLines] = useState<ReceiptDraftLine[]>([])
	  const [receiptExtraLines, setReceiptExtraLines] = useState<ReceiptExtraDraftLine[]>([])
	  const [receiptBillingMode, setReceiptBillingMode] = useState<ReceiptBillingMode>("COURSE")
	  const [receiptBillingMonth, setReceiptBillingMonth] = useState(getCurrentMonth)
	  const [receiptMethod, setReceiptMethod] = useState<PaymentMethodKey>("BANK_TRANSFER")
  const [receiptNote, setReceiptNote] = useState("")
  const [isReceiptAmountOverride, setIsReceiptAmountOverride] = useState(false)
  const [pendingBillableEnrollmentId, setPendingBillableEnrollmentId] = useState<string | null>(null)
  const [isConfirmingReceiptAmount, setIsConfirmingReceiptAmount] = useState(false)
  const [isConfirmingPayment, setIsConfirmingPayment] = useState(false)
  const [editingEnrollment, setEditingEnrollment] = useState<EnrollmentEditDraft | null>(null)
  const [transferDraft, setTransferDraft] = useState<EnrollmentTransferDraft | null>(null)
  const [selectedLearningDetail, setSelectedLearningDetail] = useState<LearningDetailTarget | null>(null)
  const [isConfirmingEnrollmentDelete, setIsConfirmingEnrollmentDelete] = useState(false)
  const [studentReceipts, setStudentReceipts] = useState<ReceiptListItem[]>([])
  const [studentWallet, setStudentWallet] = useState<StudentWalletSummary | null>(null)
  const [makeupEntitlements, setMakeupEntitlements] = useState<MakeupEntitlementItem[]>([])
  const [walletCreditInput, setWalletCreditInput] = useState("")
  const [isWalletCreditManual, setIsWalletCreditManual] = useState(false)
  const [lastReceipt, setLastReceipt] = useState<ReceiptListItem | null>(null)
  const [temporaryParentPassword, setTemporaryParentPassword] = useState<string | null>(null)
  const [photoReviewFilter, setPhotoReviewFilter] = useState<PhotoReviewFilter>("DRAFT")
  const [photoCourseFilter, setPhotoCourseFilter] = useState("ALL")
  const [photoDateFrom, setPhotoDateFrom] = useState("")
  const [photoDateTo, setPhotoDateTo] = useState("")
  const [photoCaptionDrafts, setPhotoCaptionDrafts] = useState<Record<string, string>>({})
  const [photoSavingId, setPhotoSavingId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmittingLog, setIsSubmittingLog] = useState(false)
  const [isSubmittingTask, setIsSubmittingTask] = useState(false)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isSubmittingEnrollment, setIsSubmittingEnrollment] = useState(false)
  const [isUpdatingEnrollment, setIsUpdatingEnrollment] = useState(false)
  const [isDeletingEnrollment, setIsDeletingEnrollment] = useState(false)
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false)
  const [isSubmittingReceipt, setIsSubmittingReceipt] = useState(false)
  const [isUpdatingParentAccount, setIsUpdatingParentAccount] = useState(false)
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const activeCourseOptions = useMemo(() => courses.filter((course) => course.isActive), [courses])
  const classOptions = useMemo(
    () => classes.filter((klass) => klass.isActive && (!enrollmentCourseId || klass.courseId === enrollmentCourseId)),
    [classes, enrollmentCourseId]
  )
  const editingCourse = useMemo(
    () => editingEnrollment ? student?.courses.find((course) => course.enrollmentId === editingEnrollment.enrollmentId) : undefined,
    [editingEnrollment, student?.courses]
  )
  const editingClassOptions = useMemo(
    () => classes.filter((klass) => klass.isActive && (!editingCourse || klass.courseId === editingCourse.courseId)),
    [classes, editingCourse]
  )
  const transferSourceCourse = useMemo(
    () => transferDraft ? student?.courses.find((course) => course.enrollmentId === transferDraft.fromEnrollmentId) : undefined,
    [student?.courses, transferDraft]
  )
  const transferTargetCourse = useMemo(
    () => transferDraft ? activeCourseOptions.find((course) => course.id === transferDraft.toCourseId) : undefined,
    [activeCourseOptions, transferDraft]
  )
  const transferClassOptions = useMemo(
    () => classes.filter((klass) => klass.isActive && (!transferDraft?.toCourseId || klass.courseId === transferDraft.toCourseId)),
    [classes, transferDraft]
  )
  const isCourseTransfer = Boolean(transferSourceCourse && transferTargetCourse && transferSourceCourse.courseId !== transferTargetCourse.id)
  const transferRemainingSessions = transferSourceCourse ? Math.max(0, transferSourceCourse.sessionsBought - transferSourceCourse.sessionsUsed) : 0
  const transferUnitPrice = transferSourceCourse?.courseTotalSessions ? Number(transferSourceCourse.coursePrice) / transferSourceCourse.courseTotalSessions : 0
  const transferCreditPreview = isCourseTransfer ? transferUnitPrice * transferRemainingSessions : 0
  const transferTargetPrice = transferTargetCourse ? Number(transferTargetCourse.price) : 0
  const transferTopUpPreview = Math.max(0, transferTargetPrice - transferCreditPreview)
  const selectedEnrollmentCourse = useMemo(
    () => activeCourseOptions.find((course) => course.id === enrollmentCourseId),
    [activeCourseOptions, enrollmentCourseId]
  )
  const selectedEnrollmentClass = useMemo(
    () => classOptions.find((klass) => klass.id === enrollmentClassId),
    [classOptions, enrollmentClassId]
  )
  const editingSelectedClass = useMemo(
    () => editingClassOptions.find((klass) => klass.id === editingEnrollment?.classId),
    [editingClassOptions, editingEnrollment?.classId]
  )
  const selectedEnrollmentPrice = selectedEnrollmentCourse ? Number(selectedEnrollmentCourse.price) : 0
  const selectedEnrollmentUnitPrice = selectedEnrollmentCourse?.totalSessions ? selectedEnrollmentPrice / selectedEnrollmentCourse.totalSessions : 0
  const enrollmentTotalSessions = selectedEnrollmentCourse?.totalSessions ?? 0
  const enrollmentJoinPreview = useMemo(
    () => calculateClassJoinPreview(selectedEnrollmentClass, enrollmentStartDate, enrollmentTotalSessions),
    [enrollmentStartDate, enrollmentTotalSessions, selectedEnrollmentClass]
  )
  const editingJoinPreview = useMemo(
    () => calculateClassJoinPreview(editingSelectedClass, editingEnrollment?.startDate ?? "", editingCourse?.courseTotalSessions ?? 0),
    [editingCourse?.courseTotalSessions, editingEnrollment?.startDate, editingSelectedClass]
  )
  const enrollmentSessionsFromJoin = enrollmentJoinPreview.sessionsFromJoin
  const isReceiptMonthlyBilling = receiptBillingMode === "MONTHLY"
  const receiptLineSummaries = useMemo(() => receiptLines.map((line) => {
    const course = student?.courses.find((item) => item.enrollmentId === line.enrollmentId)
    const coursePrice = Number(course?.coursePrice ?? 0)
    const totalSessions = course?.courseTotalSessions ?? 0
    const unitPrice = totalSessions ? coursePrice / totalSessions : 0
	    const freeTrialSessions = toNonNegativeNumber(line.freeTrialSessions)
	    const joinSessionNumber = course?.joinSessionNumber ?? 1
	    const sessionsFromJoin = totalSessions ? Math.max(0, totalSessions - joinSessionNumber + 1) : 0
	    const defaultBillableSessions = Math.max(0, sessionsFromJoin - freeTrialSessions)
	    const fallbackBillableSessions = Math.max(0, course?.sessionsRemaining ?? 0)
	    const monthlySessions = isReceiptMonthlyBilling ? countCourseSessionsInBillingMonth(course, classes, receiptBillingMonth) : undefined
	    const billedThisMonth = isReceiptMonthlyBilling && course ? countBilledSessionsForMonth(studentReceipts, course.enrollmentId, receiptBillingMonth) : 0
	    const monthlyBillableSessions = isReceiptMonthlyBilling && monthlySessions !== undefined ? Math.max(0, monthlySessions - billedThisMonth - freeTrialSessions) : undefined
	    const billableSessions = line.isBillableOverride ? toNonNegativeNumber(line.billableSessions) : (monthlyBillableSessions ?? (totalSessions ? defaultBillableSessions : fallbackBillableSessions))
    const paidSessionsBeforeReceipt = toNonNegativeNumber(line.paidSessionsBeforeReceipt)
    const grossAmount = unitPrice * billableSessions
    const discount = parseDiscountInputs([line.discountInput, line.extraDiscountInput], grossAmount)
    const amount = Math.max(0, grossAmount - discount.totalDiscount)
    const nextSessionsBought = (course?.sessionsBought ?? 0) + billableSessions
    const nextSessionsUsed = (course?.sessionsUsed ?? 0) + paidSessionsBeforeReceipt

    return {
      line,
      course,
      unitPrice,
      billableSessions,
	      freeTrialSessions,
	      paidSessionsBeforeReceipt,
	      monthlySessions,
	      billedThisMonth,
	      grossAmount,
      discount,
      amount,
      remainingAfterReceipt: Math.max(0, nextSessionsBought - nextSessionsUsed)
    }
	  }), [classes, isReceiptMonthlyBilling, receiptBillingMonth, receiptLines, student?.courses, studentReceipts])
  const coursePayableAmount = receiptLineSummaries.reduce((total, line) => total + line.amount, 0)
  const receiptExtraLineSummaries = useMemo(() => receiptExtraLines.map((line) => {
    const quantity = toNonNegativeNumber(line.quantity)
    const unitPrice = parseMoneyInput(line.unitPrice)

    return {
      line,
      quantity,
      unitPrice,
      amount: quantity * unitPrice
    }
  }), [receiptExtraLines])
  const extraPayableAmount = receiptExtraLineSummaries.reduce((total, line) => total + line.amount, 0)
  const payableAmount = coursePayableAmount + extraPayableAmount
  const hasManualReceiptAmount = isReceiptAmountOverride && receiptAmount !== ""
  const actualReceiptAmount = hasManualReceiptAmount ? parseMoneyInput(receiptAmount) : payableAmount
  const receiptAmountSuggestions = moneySuggestions(receiptAmount)
	  const latestReceipt = lastReceipt ?? studentReceipts[0]
	  const totalReceiptAmount = studentReceipts.reduce((total, receipt) => total + Number(receipt.amount), 0)
	  const walletBalance = Number(studentWallet?.balance ?? 0)
	  const suggestedWalletCreditAmount = Math.min(walletBalance, actualReceiptAmount)
	  const walletCreditAmount = isWalletCreditManual ? parseMoneyInput(walletCreditInput) : suggestedWalletCreditAmount
	  const actualReceiptPaymentAmount = Math.max(0, actualReceiptAmount - walletCreditAmount)
	  const receiptBillingYearOptions = useMemo(() => buildYearOptions(getYearPart(receiptBillingMonth)), [receiptBillingMonth])
	  const receiptValidationErrors = useMemo(() => {
    const errors: string[] = []

    receiptLines.forEach((line) => {
      const courseName = student?.courses.find((course) => course.enrollmentId === line.enrollmentId)?.courseName ?? "Khóa đã đăng ký"

      if (hasNegativeSign(line.freeTrialSessions)) errors.push(`${courseName}: học thử không được âm.`)
      if (hasNegativeSign(line.paidSessionsBeforeReceipt)) errors.push(`${courseName}: đã học trước không được âm.`)
      if (line.isBillableOverride && hasNegativeSign(line.billableSessions)) errors.push(`${courseName}: số buổi tính phí không được âm.`)
    })

    receiptLineSummaries.forEach((summary) => {
      if (summary.billableSessions < 0) errors.push(`${summary.course?.courseName ?? "Khóa đã đăng ký"}: số buổi tính phí không được âm.`)
      if (summary.paidSessionsBeforeReceipt > summary.billableSessions) errors.push(`${summary.course?.courseName ?? "Khóa đã đăng ký"}: đã học trước không được lớn hơn số buổi tính phí.`)
    })

    receiptExtraLineSummaries.forEach((summary) => {
      if (!summary.line.description.trim()) errors.push("Dòng cần thu riêng cần có mô tả.")
      if (hasNegativeSign(summary.line.quantity) || summary.quantity <= 0) errors.push(`${summary.line.description || "Cần thu riêng"}: số giờ/số lượng phải lớn hơn 0.`)
      if (summary.unitPrice <= 0) errors.push(`${summary.line.description || "Cần thu riêng"}: đơn giá phải lớn hơn 0.`)
    })

    if (actualReceiptAmount < 0) errors.push("Phụ huynh cần thanh toán không được âm.")
    if (walletCreditAmount > walletBalance) errors.push("Credit áp dụng không được vượt quá số dư ví.")
    if (walletCreditAmount > actualReceiptAmount) errors.push("Credit áp dụng không được vượt quá số tiền phiếu thu.")
    if (receiptLines.length && !receiptLineSummaries.some((summary) => summary.billableSessions > 0) && !receiptExtraLineSummaries.length && !hasManualReceiptAmount) {
      errors.push("Không có buổi tính phí sau học thử. Hãy kiểm tra lại số buổi học thử hoặc nhập số tiền cần thu nếu đây là ngoại lệ.")
    }

    return errors
  }, [actualReceiptAmount, hasManualReceiptAmount, receiptExtraLineSummaries, receiptLineSummaries, receiptLines, student?.courses, walletBalance, walletCreditAmount])
  const photoCourseOptions = useMemo(() => {
    const names = new Set((student?.photos ?? []).map((photo) => photo.courseName).filter(Boolean))
    return Array.from(names).sort() as string[]
  }, [student?.photos])
  const filteredPhotos = useMemo(() => {
    const fromTime = photoDateFrom ? new Date(`${photoDateFrom}T00:00:00`).getTime() : undefined
    const toTime = photoDateTo ? new Date(`${photoDateTo}T23:59:59`).getTime() : undefined

    return (student?.photos ?? []).filter((photo) => {
      const takenTime = new Date(photo.takenAt).getTime()
      const matchesStatus =
        photoReviewFilter === "ALL" ||
        (photoReviewFilter === "DRAFT" ? !photo.isPublished : photo.isPublished)
      const matchesCourse = photoCourseFilter === "ALL" || photo.courseName === photoCourseFilter
      const matchesFrom = fromTime === undefined || takenTime >= fromTime
      const matchesTo = toTime === undefined || takenTime <= toTime

      return matchesStatus && matchesCourse && matchesFrom && matchesTo
    })
  }, [photoCourseFilter, photoDateFrom, photoDateTo, photoReviewFilter, student?.photos])

  function syncProfileForm(nextStudent: StudentDetail) {
    setProfileName(nextStudent.name)
    setProfileBirthDate(nextStudent.birthDate?.slice(0, 10) ?? "")
    setProfileStatus(nextStudent.status)
    setProfileParentName(nextStudent.parentName)
    setProfileParentPhone(nextStudent.parentPhone)
    setProfileParentEmail(nextStudent.parentEmail ?? "")
    setProfileAddress(nextStudent.address ?? "")
    setProfileLeadSource(nextStudent.leadSource ?? "")
    setProfileLeadNote(nextStudent.leadNote ?? "")
    setProfileHealthNote(nextStudent.healthNote ?? "")
  }

  async function loadStudent() {
    setError(null)

    try {
      const response = await fetch(`/api/students/${studentId}`, { cache: "no-store" })
      const payload = (await response.json()) as ApiResponse<StudentDetail>

      if (!response.ok || !payload.success || !payload.data) {
        setError(payload.error?.message ?? "Không tải được hồ sơ học viên.")
        return
      }

      const nextStudent = payload.data
      setStudent(nextStudent)
      setPhotoCaptionDrafts(Object.fromEntries(nextStudent.photos.map((photo) => [photo.id, photo.caption ?? ""])))
      syncProfileForm(nextStudent)
      setReceiptLines((current) => current.length ? current : activeStudentCourses(nextStudent).slice(0, 1).map(toReceiptDraftLine))
    } catch {
      setError("Không tải được hồ sơ học viên.")
    }
  }

  async function loadReceipts() {
    const response = await fetch(`/api/receipts?studentId=${studentId}`, { cache: "no-store" })
    const payload = (await response.json()) as ApiResponse<ReceiptListItem[]>

    if (!response.ok || !payload.success || !payload.data) {
      throw new Error(payload.error?.message ?? "Không tải được lịch sử phiếu thu.")
    }

    const receipts = payload.data
    setStudentReceipts(receipts)
    setLastReceipt((current) => current ?? receipts[0] ?? null)
  }

  async function loadFinanceLedger() {
    const [walletResponse, makeupResponse] = await Promise.all([
      fetch(`/api/student-wallet?studentId=${studentId}`, { cache: "no-store" }),
      fetch(`/api/makeup-entitlements?studentId=${studentId}`, { cache: "no-store" })
    ])
    const walletPayload = (await walletResponse.json()) as ApiResponse<StudentWalletSummary>
    const makeupPayload = (await makeupResponse.json()) as ApiResponse<MakeupEntitlementItem[]>

    setStudentWallet(walletResponse.ok && walletPayload.success && walletPayload.data ? walletPayload.data : null)
    setMakeupEntitlements(makeupResponse.ok && makeupPayload.success && makeupPayload.data ? makeupPayload.data : [])
  }

  useEffect(() => {
    let isMounted = true

    async function loadInitialData() {
      setIsLoading(true)
      setError(null)

      try {
        const [studentResponse, coursesResponse, classesResponse, receiptsResponse, walletResponse, makeupResponse] = await Promise.all([
          fetch(`/api/students/${studentId}`, { cache: "no-store" }),
          fetch("/api/courses"),
          fetch("/api/classes?active=true"),
          fetch(`/api/receipts?studentId=${studentId}`, { cache: "no-store" }),
          fetch(`/api/student-wallet?studentId=${studentId}`, { cache: "no-store" }),
          fetch(`/api/makeup-entitlements?studentId=${studentId}`, { cache: "no-store" })
        ])
        const studentPayload = (await studentResponse.json()) as ApiResponse<StudentDetail>
        const coursesPayload = (await coursesResponse.json()) as ApiResponse<CourseListItem[]>
        const classesPayload = (await classesResponse.json()) as ApiResponse<ClassListItem[]>
        const receiptsPayload = (await receiptsResponse.json()) as ApiResponse<ReceiptListItem[]>
        const walletPayload = (await walletResponse.json()) as ApiResponse<StudentWalletSummary>
        const makeupPayload = (await makeupResponse.json()) as ApiResponse<MakeupEntitlementItem[]>

        if (!isMounted) return

        if (!studentResponse.ok || !studentPayload.success || !studentPayload.data) {
          setError(studentPayload.error?.message ?? "Không tải được hồ sơ học viên.")
          return
        }

        const nextStudent = studentPayload.data
        setStudent(nextStudent)
        setPhotoCaptionDrafts(Object.fromEntries(nextStudent.photos.map((photo) => [photo.id, photo.caption ?? ""])))
        syncProfileForm(nextStudent)
        setReceiptLines((current) => current.length ? current : activeStudentCourses(nextStudent).slice(0, 1).map(toReceiptDraftLine))

        if (coursesPayload.success && coursesPayload.data) {
          setCourses(coursesPayload.data)
          setEnrollmentCourseId((current) => current || coursesPayload.data?.find((course) => course.isActive)?.id || "")
        }

        if (classesPayload.success && classesPayload.data) {
          setClasses(classesPayload.data)
        }

        if (receiptsPayload.success && receiptsPayload.data) {
          setStudentReceipts(receiptsPayload.data)
          setLastReceipt((current) => current ?? receiptsPayload.data?.[0] ?? null)
        }

        setStudentWallet(walletResponse.ok && walletPayload.success && walletPayload.data ? walletPayload.data : null)
        setMakeupEntitlements(makeupResponse.ok && makeupPayload.success && makeupPayload.data ? makeupPayload.data : [])
      } catch {
        if (isMounted) setError("Không tải được hồ sơ học viên.")
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    void loadInitialData()

    return () => {
      isMounted = false
    }
  }, [studentId])

  async function submitProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSavingProfile(true)
    setError(null)

    try {
      const response = await fetch(`/api/students/${studentId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: profileName.trim(),
          birthDate: profileBirthDate ? new Date(`${profileBirthDate}T00:00:00`).toISOString() : null,
          status: profileStatus,
          address: profileAddress.trim() || null,
          leadSource: profileLeadSource.trim() || null,
          leadNote: profileLeadNote.trim() || null,
          healthNote: profileHealthNote.trim() || null,
          parent: {
            name: profileParentName.trim(),
            phone: profileParentPhone.trim(),
            email: profileParentEmail.trim() || null
          }
        })
      })
      const payload = (await response.json()) as ApiResponse<StudentDetail>

      if (!response.ok || !payload.success || !payload.data) {
        setError(payload.error?.message ?? "Không cập nhật được hồ sơ học viên.")
        return
      }

      setStudent(payload.data)
      setPhotoCaptionDrafts(Object.fromEntries(payload.data.photos.map((photo) => [photo.id, photo.caption ?? ""])))
      syncProfileForm(payload.data)
    } catch {
      setError("Không cập nhật được hồ sơ học viên.")
    } finally {
      setIsSavingProfile(false)
    }
  }

  async function submitContactLog(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmittingLog(true)
    setError(null)

    try {
      const response = await fetch(`/api/students/${studentId}/contact-logs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          result
        })
      })
      const payload = (await response.json()) as ApiResponse<StudentContactLogItem>

      if (!response.ok || !payload.success || !payload.data) {
        setError(payload.error?.message ?? "Không lưu được lịch sử liên hệ.")
        return
      }

      setStudent((current) => current ? { ...current, contactLogs: [payload.data as StudentContactLogItem, ...current.contactLogs] } : current)
      setContent("")
      setResult("INTERESTED")
    } catch {
      setError("Không lưu được lịch sử liên hệ.")
    } finally {
      setIsSubmittingLog(false)
    }
  }

  async function submitTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmittingTask(true)
    setError(null)

    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: taskTitle.trim(),
          note: taskNote.trim() || undefined,
          dueDate: new Date(`${taskDueDate}T17:00:00`).toISOString(),
          studentId
        })
      })
      const payload = (await response.json()) as ApiResponse<StudentTaskItem>

      if (!response.ok || !payload.success || !payload.data) {
        setError(payload.error?.message ?? "Không tạo được task.")
        return
      }

      setStudent((current) => current ? { ...current, tasks: [payload.data as StudentTaskItem, ...current.tasks] } : current)
      setTaskTitle("")
      setTaskNote("")
      setTaskDueDate(new Date().toISOString().slice(0, 10))
    } catch {
      setError("Không tạo được task.")
    } finally {
      setIsSubmittingTask(false)
    }
  }

  async function markTaskDone(taskId: string) {
    setSavingTaskId(taskId)
    setError(null)

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "DONE" })
      })
      const payload = (await response.json()) as ApiResponse<StudentTaskItem>

      if (!response.ok || !payload.success || !payload.data) {
        setError(payload.error?.message ?? "Không cập nhật được task.")
        return
      }

      setStudent((current) => current ? { ...current, tasks: current.tasks.map((task) => (task.id === taskId ? (payload.data as StudentTaskItem) : task)) } : current)
    } catch {
      setError("Không cập nhật được task.")
    } finally {
      setSavingTaskId(null)
    }
  }

  async function patchStudentPhoto(photoId: string, body: { caption?: string | null; isFeatured?: boolean; isPublished?: boolean; markSent?: boolean }) {
    setPhotoSavingId(photoId)
    setError(null)

    try {
      const response = await fetch(`/api/class-photos/${photoId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      })
      const payload = (await response.json()) as ApiResponse<ClassPhotoListItem>

      if (!response.ok || !payload.success || !payload.data) {
        setError(payload.error?.message ?? "Không cập nhật được ảnh học viên.")
        return
      }

      await loadStudent()
    } catch {
      setError("Không cập nhật được ảnh học viên.")
    } finally {
      setPhotoSavingId(null)
    }
  }

  async function deleteStudentPhoto(photoId: string) {
    if (!window.confirm("Xóa ảnh này khỏi hồ sơ học viên?")) return

    setPhotoSavingId(photoId)
    setError(null)

    try {
      const response = await fetch(`/api/class-photos/${photoId}`, { method: "DELETE" })
      const payload = (await response.json()) as ApiResponse<{ deleted: boolean }>

      if (!response.ok || !payload.success) {
        setError(payload.error?.message ?? "Không xóa được ảnh học viên.")
        return
      }

      await loadStudent()
    } catch {
      setError("Không xóa được ảnh học viên.")
    } finally {
      setPhotoSavingId(null)
    }
  }

  async function submitEnrollment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmittingEnrollment(true)
    setError(null)

    try {
      const response = await fetch("/api/enrollments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          studentId,
          courseId: enrollmentCourseId,
          classId: enrollmentClassId || undefined,
          sessionsBought: toNonNegativeNumber(enrollmentSessions),
          totalCourseSessionsAtJoin: selectedEnrollmentCourse?.totalSessions,
          freeTrialSessions: toNonNegativeNumber(enrollmentFreeTrialSessions),
          startDate: new Date(`${enrollmentStartDate}T00:00:00`).toISOString()
        })
      })
      const payload = (await response.json()) as ApiResponse<unknown>

      if (!response.ok || !payload.success) {
        setError(payload.error?.message ?? "Không ghi danh được khóa học.")
        return
      }

      setEnrollmentClassId("")
      setEnrollmentSessions("0")
      setEnrollmentFreeTrialSessions("0")
      await loadStudent()
    } catch {
      setError("Không ghi danh được khóa học.")
    } finally {
      setIsSubmittingEnrollment(false)
    }
  }

  async function submitEnrollmentEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingEnrollment) return

    const sessionsBought = toNonNegativeNumber(editingEnrollment.sessionsBought)
    const sessionsUsed = toNonNegativeNumber(editingEnrollment.sessionsUsed)

    if (sessionsUsed > sessionsBought) {
      setError("Số buổi đã học không được lớn hơn số buổi đã cấp.")
      return
    }

    setIsUpdatingEnrollment(true)
    setError(null)

    try {
      const response = await fetch(`/api/enrollments/${editingEnrollment.enrollmentId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          classId: editingEnrollment.classId || null,
          sessionsBought,
          sessionsUsed,
          freeTrialSessions: toNonNegativeNumber(editingEnrollment.freeTrialSessions),
          startDate: editingEnrollment.startDate ? new Date(`${editingEnrollment.startDate}T00:00:00`).toISOString() : null,
          isActive: editingEnrollment.isActive
        })
      })
      const payload = (await response.json()) as ApiResponse<unknown>

      if (!response.ok || !payload.success) {
        setError(payload.error?.message ?? "Không cập nhật được khóa đã đăng ký.")
        return
      }

      setEditingEnrollment(null)
      setReceiptLines([])
      setReceiptAmount("")
      setIsReceiptAmountOverride(false)
      await loadStudent()
    } catch {
      setError("Không cập nhật được khóa đã đăng ký.")
    } finally {
      setIsUpdatingEnrollment(false)
    }
  }

  async function deleteOrCancelEnrollment() {
    if (!editingEnrollment) return

    setIsDeletingEnrollment(true)
    setError(null)

    try {
      const response = await fetch(`/api/enrollments/${editingEnrollment.enrollmentId}`, {
        method: "DELETE"
      })
      const payload = (await response.json()) as ApiResponse<EnrollmentDeleteResult>

      if (!response.ok || !payload.success || !payload.data) {
        setError(payload.error?.message ?? "Không xóa hoặc hủy được ghi danh.")
        return
      }

      setEditingEnrollment(null)
      setIsConfirmingEnrollmentDelete(false)
      setReceiptLines([])
      setReceiptAmount("")
      setIsReceiptAmountOverride(false)
      await loadStudent()
    } catch {
      setError("Không xóa hoặc hủy được ghi danh.")
    } finally {
      setIsDeletingEnrollment(false)
    }
  }

  function openTransferDialog(course: StudentDetail["courses"][number]) {
    setTransferDraft({
      fromEnrollmentId: course.enrollmentId,
      toCourseId: course.courseId,
      toClassId: "",
      startDate: new Date().toISOString().slice(0, 10),
      reason: ""
    })
  }

  async function submitTransfer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!transferDraft) return

    if (!transferDraft.reason.trim()) {
      setError("Cần nhập lý do chuyển lớp/khóa.")
      return
    }

    setIsSubmittingTransfer(true)
    setError(null)

    try {
      const response = await fetch("/api/enrollment-transfers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fromEnrollmentId: transferDraft.fromEnrollmentId,
          toCourseId: transferDraft.toCourseId,
          toClassId: transferDraft.toClassId || undefined,
          startDate: transferDraft.startDate ? new Date(`${transferDraft.startDate}T00:00:00`).toISOString() : undefined,
          reason: transferDraft.reason.trim()
        })
      })
      const payload = (await response.json()) as ApiResponse<EnrollmentTransferResult>

      if (!response.ok || !payload.success || !payload.data) {
        setError(payload.error?.message ?? "Không chuyển lớp/khóa được.")
        return
      }

      setTransferDraft(null)
      setReceiptAmount("")
      setIsReceiptAmountOverride(false)
      setIsWalletCreditManual(false)

      if (payload.data.isCourseTransfer) {
        setReceiptLines([toReceiptDraftLine(payload.data.enrollment)])
      }

      await loadStudent()
      await loadFinanceLedger()
    } catch {
      setError("Không chuyển lớp/khóa được.")
    } finally {
      setIsSubmittingTransfer(false)
    }
  }

  async function submitReceipt(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (receiptValidationErrors.length) {
      setError(receiptValidationErrors[0])
      return
    }

    setError(null)
    setIsConfirmingPayment(true)
  }

	  async function confirmReceiptPayment() {
	    setIsSubmittingReceipt(true)
	    setError(null)
	    const billingPeriod = isReceiptMonthlyBilling ? getBillingPeriodForMonth(receiptBillingMonth) : null

	    try {
	      const response = await fetch("/api/receipts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          studentId,
          amount: hasManualReceiptAmount ? actualReceiptAmount : undefined,
          lines: receiptLineSummaries.map((summary) => ({
            enrollmentId: summary.line.enrollmentId,
            billableSessions: summary.billableSessions,
	            freeTrialSessions: summary.freeTrialSessions,
	            paidSessionsBeforeReceipt: summary.paidSessionsBeforeReceipt,
	            discountInput: summary.line.discountInput.trim() || undefined,
	            extraDiscountInput: summary.line.extraDiscountInput.trim() || undefined,
	            billingPeriodStart: billingPeriod?.startIso,
	            billingPeriodEnd: billingPeriod?.endIso,
	            billingLabel: billingPeriod?.label
	          })),
          extraLines: receiptExtraLineSummaries.map((summary) => ({
            type: summary.line.type,
            description: summary.line.description.trim(),
            quantity: summary.quantity,
            unitPrice: summary.unitPrice,
            note: summary.line.note.trim() || undefined
          })),
          walletCreditAmount: walletCreditAmount > 0 ? walletCreditAmount : undefined,
          method: receiptMethod,
          note: receiptNote.trim() || undefined
        })
      })
      const payload = (await response.json()) as ApiResponse<ReceiptListItem>

      if (!response.ok || !payload.success || !payload.data) {
        setError(payload.error?.message ?? "Không tạo được phiếu thu.")
        return
      }

      setReceiptAmount("")
      setWalletCreditInput("")
      setIsWalletCreditManual(false)
      setIsReceiptAmountOverride(false)
      setReceiptBillingMode("COURSE")
      setReceiptNote("")
      setReceiptExtraLines([])
      setIsConfirmingPayment(false)
      setLastReceipt(payload.data)
      await loadStudent()
      await loadReceipts()
      await loadFinanceLedger()
    } catch {
      setError("Không tạo được phiếu thu.")
    } finally {
      setIsSubmittingReceipt(false)
    }
  }

  async function updateParentAccount(action: ParentAccountAction) {
    setIsUpdatingParentAccount(true)
    setError(null)

    try {
      const response = await fetch(`/api/students/${studentId}/parent-account`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action })
      })
      const payload = (await response.json()) as ApiResponse<ParentAccountInfo>

      if (!response.ok || !payload.success || !payload.data) {
        setError(payload.error?.message ?? "Không cập nhật được tài khoản phụ huynh.")
        return
      }

      setStudent((current) => current ? { ...current, parentAccount: payload.data as ParentAccountInfo } : current)
      setTemporaryParentPassword(payload.data.temporaryPassword ?? null)
    } catch {
      setError("Không cập nhật được tài khoản phụ huynh.")
    } finally {
      setIsUpdatingParentAccount(false)
    }
  }

  function toggleReceiptLine(course: StudentDetail["courses"][number]) {
    setReceiptLines((current) => {
      if (current.some((line) => line.enrollmentId === course.enrollmentId)) {
        return current.filter((line) => line.enrollmentId !== course.enrollmentId)
      }

      return [...current, toReceiptDraftLine(course)]
    })
    setReceiptAmount("")
    setIsReceiptAmountOverride(false)
    setIsWalletCreditManual(false)
  }

  function updateReceiptLine(enrollmentId: string, patch: Partial<ReceiptDraftLine>) {
    setReceiptLines((current) => current.map((line) => line.enrollmentId === enrollmentId ? { ...line, ...patch } : line))
    setReceiptAmount("")
    setIsReceiptAmountOverride(false)
    setIsWalletCreditManual(false)
  }

  function addReceiptExtraLine() {
    setReceiptExtraLines((current) => [
      ...current,
      {
        id: `extra-${Date.now()}`,
        type: "TUTORING",
        description: "Phụ đạo theo giờ",
        quantity: "1",
        unitPrice: "",
        note: ""
      }
    ])
    setReceiptAmount("")
    setIsReceiptAmountOverride(false)
    setIsWalletCreditManual(false)
  }

  function updateReceiptExtraLine(id: string, patch: Partial<ReceiptExtraDraftLine>) {
    setReceiptExtraLines((current) => current.map((line) => line.id === id ? { ...line, ...patch } : line))
    setReceiptAmount("")
    setIsReceiptAmountOverride(false)
    setIsWalletCreditManual(false)
  }

  function removeReceiptExtraLine(id: string) {
    setReceiptExtraLines((current) => current.filter((line) => line.id !== id))
    setReceiptAmount("")
    setIsReceiptAmountOverride(false)
    setIsWalletCreditManual(false)
  }

  function confirmBillableOverride() {
    if (!pendingBillableEnrollmentId) return

    const summary = receiptLineSummaries.find((line) => line.line.enrollmentId === pendingBillableEnrollmentId)
    updateReceiptLine(pendingBillableEnrollmentId, {
      isBillableOverride: true,
      billableSessions: String(summary?.billableSessions ?? 0)
    })
    setPendingBillableEnrollmentId(null)
  }

  function confirmReceiptAmountOverride() {
    setReceiptAmount(formatMoneyInput(Math.round(payableAmount)))
    setIsReceiptAmountOverride(true)
    setIsConfirmingReceiptAmount(false)
  }

  if (isLoading) {
    return <p className="neu-card rounded-3xl p-6 text-sm text-stone-500">Đang tải hồ sơ học viên...</p>
  }

  if (!student) {
    return (
      <main className="space-y-4">
        <Link href="/students" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-red">
          <ArrowLeft className="h-4 w-4" />
          Quay lại học viên
        </Link>
        <p className="neu-card rounded-3xl p-6 text-sm text-brand-red">{error ?? "Không tìm thấy học viên."}</p>
      </main>
    )
  }

  return (
    <main className="space-y-4">
      <Link href="/students" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-red">
        <ArrowLeft className="h-4 w-4" />
        Quay lại học viên
      </Link>

      <section className="neu-card rounded-3xl p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="neu-pressed flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl">
              <UserRound className="h-7 w-7 text-brand-red" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-widest text-brand-red">Student profile</p>
              <h1 className="truncate text-3xl font-semibold text-brand-ink">{student.name}</h1>
              <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-full border border-brand-red/15 px-3 py-1 text-brand-red">{student.code}</span>
                <span className="rounded-full border border-brand-red/15 px-3 py-1 text-stone-600">{studentStatusLabels[student.status]}</span>
                <span className="rounded-full border border-brand-red/15 px-3 py-1 text-stone-600">{student.parentName} · {student.parentPhone}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {detailTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${
                  activeTab === tab.key ? "border-brand-red bg-brand-red text-white" : "border-brand-red/10 bg-white/45 text-stone-600 hover:text-brand-red"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {error ? <p className="rounded-3xl border border-brand-red/15 bg-white/50 p-4 text-sm text-brand-red">{error}</p> : null}

      {activeTab === "overview" ? (
        <section className="grid gap-4 xl:grid-cols-[1.25fr_0.9fr]">
          <form className="neu-card rounded-3xl" onSubmit={submitProfile}>
            <div className="p-5">
              <h2 className="font-semibold text-brand-ink">Cập nhật hồ sơ</h2>
              <p className="mt-1 text-sm text-stone-500">Thông tin cốt lõi, trạng thái CRM và ghi chú vận hành.</p>
            </div>
            <div className="content-border grid gap-4 p-5 md:grid-cols-2">
              <DetailInput label="Tên học viên" value={profileName} onChange={setProfileName} required />
              <label className="block text-sm font-semibold text-stone-700">
                Ngày sinh
                <input className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none" type="date" value={profileBirthDate} onChange={(event) => setProfileBirthDate(event.target.value)} />
              </label>
              <label className="block text-sm font-semibold text-stone-700">
                Trạng thái
                <select className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none" value={profileStatus} onChange={(event) => setProfileStatus(event.target.value as StudentStatusKey)}>
                  {studentStatusOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
              </label>
              <DetailInput label="Nguồn lead" value={profileLeadSource} onChange={setProfileLeadSource} />
              <DetailInput label="Tên phụ huynh" value={profileParentName} onChange={setProfileParentName} required />
              <DetailInput label="Số điện thoại phụ huynh" value={profileParentPhone} onChange={setProfileParentPhone} required />
              <DetailInput label="Email phụ huynh" type="email" value={profileParentEmail} onChange={setProfileParentEmail} />
              <DetailInput label="Địa chỉ" value={profileAddress} onChange={setProfileAddress} />
              <label className="block text-sm font-semibold text-stone-700 md:col-span-2">
                Ghi chú lead
                <textarea className="neu-pressed mt-2 min-h-24 w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none placeholder:text-stone-400" value={profileLeadNote} onChange={(event) => setProfileLeadNote(event.target.value)} />
              </label>
              <label className="block text-sm font-semibold text-stone-700 md:col-span-2">
                Lưu ý sức khỏe / đặc biệt
                <textarea className="neu-pressed mt-2 min-h-24 w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none placeholder:text-stone-400" value={profileHealthNote} onChange={(event) => setProfileHealthNote(event.target.value)} />
              </label>
            </div>
            <div className="flex justify-end p-5">
              <button type="submit" disabled={isSavingProfile} className="glass-button-primary inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60">
                <Save className="h-4 w-4" />
                {isSavingProfile ? "Đang lưu" : "Lưu hồ sơ"}
              </button>
            </div>
          </form>
          <div className="space-y-4">
            <InfoCard title="Thông tin phụ huynh" items={[student.parentName, student.parentPhone, student.parentEmail ?? "Chưa có email", student.address ?? "Chưa có địa chỉ"]} />
            <InfoCard title="Học tập" items={[`Còn ${student.sessionsRemaining} buổi`, student.assignedTeacherName ?? "Chưa phân giáo viên", student.leadSource ?? "Chưa có nguồn lead"]} />
            <InfoCard title="Ghi chú" items={[student.leadNote ?? "Chưa có ghi chú lead", student.healthNote ?? "Chưa có lưu ý sức khỏe"]} />
          </div>
        </section>
      ) : null}

      {activeTab === "crm" ? (
        <section className="grid gap-4 xl:grid-cols-[1fr_1.15fr]">
          <div className="space-y-4">
            <form className="neu-card rounded-3xl" onSubmit={submitContactLog}>
              <SectionHeader title="Ghi lịch sử liên hệ" description="Lưu nội dung trao đổi với phụ huynh." />
              <div className="content-border space-y-3 p-5">
                <select className="neu-pressed w-full rounded-2xl bg-transparent px-4 py-3 text-sm font-medium text-brand-ink outline-none" value={result} onChange={(event) => setResult(event.target.value as ContactResultKey)}>
                  {contactResults.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
                <textarea className="neu-pressed min-h-28 w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none placeholder:text-stone-400" value={content} onChange={(event) => setContent(event.target.value)} placeholder="Nội dung cuộc gọi, tin nhắn, kết luận tiếp theo..." required />
              </div>
              <FormFooter loading={isSubmittingLog} label="Lưu liên hệ" loadingLabel="Đang lưu" />
            </form>
            <form className="neu-card rounded-3xl" onSubmit={submitTask}>
              <SectionHeader title="Tạo task follow-up" description="Task mới sẽ gán cho người đang đăng nhập." />
              <div className="content-border space-y-3 p-5">
                <input className="neu-pressed w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none placeholder:text-stone-400" value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="Tiêu đề task" required />
                <input className="neu-pressed w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none" type="date" value={taskDueDate} onChange={(event) => setTaskDueDate(event.target.value)} required />
                <textarea className="neu-pressed min-h-20 w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none placeholder:text-stone-400" value={taskNote} onChange={(event) => setTaskNote(event.target.value)} placeholder="Ghi chú xử lý..." />
              </div>
              <FormFooter loading={isSubmittingTask} label="Tạo task" loadingLabel="Đang tạo" />
            </form>
          </div>
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-1">
            <ListCard title="Lịch sử liên hệ" count={`${student.contactLogs.length} lần`}>
              {student.contactLogs.length ? student.contactLogs.map((log) => (
                <article key={log.id} className="neu-list-item rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-brand-ink">{contactResultLabels[log.result]}</p>
                    <p className="text-xs text-stone-500">{formatDate(log.createdAt)}</p>
                  </div>
                  <p className="mt-2 text-sm text-stone-600">{log.content}</p>
                  <p className="mt-3 inline-flex items-center gap-1 text-xs text-stone-500"><Phone className="h-3.5 w-3.5" />{log.loggedByName}</p>
                </article>
              )) : <EmptyState text="Chưa có lịch sử liên hệ." />}
            </ListCard>
            <ListCard title="Task liên quan" count={`${student.tasks.length} task`}>
              {student.tasks.length ? student.tasks.map((task) => (
                <article key={task.id} className="neu-list-item rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-brand-ink">{task.title}</p>
                      <p className="mt-1 text-xs text-stone-500">{task.note ?? "Không có ghi chú."}</p>
                    </div>
                    <p className="text-xs font-semibold text-brand-red">{taskStatusLabels[task.status]}</p>
                  </div>
                  <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <p className="text-xs text-stone-500">{task.assignedToName} · hạn {formatDate(task.dueDate)}</p>
                    {task.status !== "DONE" ? (
                      <button type="button" disabled={savingTaskId === task.id} onClick={() => void markTaskDone(task.id)} className="neu-list-item inline-flex items-center justify-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold text-stone-600 hover:text-brand-red disabled:cursor-not-allowed disabled:opacity-60">
                        <CheckCircle2 className="h-4 w-4" />
                        {savingTaskId === task.id ? "Đang lưu" : "Hoàn thành"}
                      </button>
                    ) : null}
                  </div>
                </article>
              )) : <EmptyState text="Chưa có task." />}
            </ListCard>
          </div>
        </section>
      ) : null}

      {activeTab === "learning" ? (
        <section className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-2">
            <ListCard title="Khóa học / quỹ buổi" count={`${student.sessionsRemaining} buổi còn lại`}>
              {student.courses.length ? student.courses.map((course) => (
                <button key={course.enrollmentId} type="button" className="neu-list-item w-full rounded-2xl p-4 text-left transition hover:shadow-md" onClick={() => setSelectedLearningDetail({ kind: "course", course })}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-brand-ink">{course.courseName}</p>
                      <p className="mt-1 text-xs text-stone-500">{course.courseSubject}{course.classProgress ? ` · ${course.classProgress.label}` : ""}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-brand-red">{course.sessionsRemaining} buổi</p>
                      {!course.isActive ? <p className="mt-1 rounded-full border border-brand-red/15 px-2 py-1 text-[11px] font-semibold text-stone-500">Đã hủy</p> : null}
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-stone-500">Đã dùng {course.sessionsUsed}/{course.sessionsBought} buổi</p>
                </button>
              )) : <EmptyState text="Chưa đăng ký khóa học." />}
            </ListCard>
            <ListCard title="Lớp đang tham gia" count={`${student.classes.length} lớp`}>
              {student.classes.length ? student.classes.map((klass) => (
                <button key={klass.id} type="button" className="neu-list-item w-full rounded-2xl p-4 text-left transition hover:shadow-md" onClick={() => setSelectedLearningDetail({ kind: "class", klass })}>
                  <p className="text-sm font-semibold text-brand-ink">{klass.name}</p>
                  <p className="mt-1 text-xs text-stone-500">{klass.courseName} · GV {klass.teacherName}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-stone-500">
                    <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" />{formatWeekday(klass.weekday)}, {klass.startTime}-{klass.endTime}</span>
                    {klass.progress ? <span className="rounded-full border border-brand-red/15 px-2 py-1 font-semibold text-brand-red">{klass.progress.label}</span> : null}
                  </div>
                </button>
              )) : <EmptyState text="Chưa xếp lớp." />}
            </ListCard>
          </div>
          <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <ListCard title="Tiến độ đánh giá" count={`${student.assessmentProgress.length} khóa`}>
              {student.assessmentProgress.length ? student.assessmentProgress.map((progress) => {
                const percent = assessmentProgressPercent(progress)

                return (
                  <article key={progress.enrollmentId} className="neu-list-item rounded-2xl p-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-brand-ink">{progress.courseName}</p>
                        <p className="mt-1 text-xs text-stone-500">{subjectLabels[progress.subject]} · {progress.completedWeeks}/{progress.totalWeeks} tuần hoàn thành</p>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full border border-brand-red/15 px-3 py-1 text-xs font-semibold text-brand-red">
                        <BarChart3 className="h-3.5 w-3.5" />
                        {percent}%
                      </span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-brand-red/10">
                      <div className="h-full rounded-full bg-brand-red" style={{ width: `${percent}%` }} />
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-stone-500 md:grid-cols-3">
                      <span>Tuần mới nhất: {progress.latestWeek ? `Tuần ${progress.latestWeek}` : "Chưa có"}</span>
                      <span>Checklist: {progress.checkedItems}/{progress.totalItems || 0}</span>
                      <span>{progress.finalAssessmentId ? `Cuối khóa: ${progress.finalCreatedAt ? formatDate(progress.finalCreatedAt) : "Đã có"}` : "Chưa có cuối khóa"}</span>
                    </div>
                  </article>
                )
              }) : <EmptyState text="Chưa có dữ liệu đánh giá." />}
            </ListCard>
            <ListCard title="Timeline học tập" count={`${student.learningTimeline.length} mốc`}>
              {student.learningTimeline.length ? student.learningTimeline.map((item) => {
                const statusLabel = timelineStatusLabel(item)

                return (
                  <article key={item.id} className="neu-list-item rounded-2xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full border border-brand-red/15 px-2 py-1 text-[11px] font-semibold text-brand-red">
                            <ClipboardCheck className="h-3.5 w-3.5" />
                            {timelineTypeLabel(item.type)}
                          </span>
                          {item.subject ? <span className="rounded-full border border-brand-red/10 px-2 py-1 text-[11px] font-semibold text-stone-500">{subjectLabels[item.subject]}</span> : null}
                          {statusLabel ? <span className="rounded-full border border-brand-red/10 px-2 py-1 text-[11px] font-semibold text-stone-500">{statusLabel}</span> : null}
                        </div>
                        <p className="mt-2 text-sm font-semibold text-brand-ink">{item.title}</p>
                        {item.description ? <p className="mt-1 line-clamp-2 text-xs text-stone-500">{item.description}</p> : null}
                        {item.meta ? <p className="mt-2 text-xs font-semibold text-stone-500">{item.meta}</p> : null}
                      </div>
                      <p className="shrink-0 text-xs text-stone-500">{formatDate(item.date)}</p>
                    </div>
                  </article>
                )
              }) : <EmptyState text="Chưa có timeline học tập." />}
            </ListCard>
          </div>
        </section>
      ) : null}

      {activeTab === "finance" ? (
        <section className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <InfoPill label="Tổng còn lại" value={`${student.sessionsRemaining} buổi`} />
            <InfoPill label="Khóa đang hoạt động" value={`${activeStudentCourses(student).length} khóa`} />
            <InfoPill label="Đã thu tất cả" value={studentReceipts.length ? formatCurrency(totalReceiptAmount) : "Chưa có phiếu"} />
            <InfoPill label="Số dư credit" value={studentWallet ? formatCurrency(walletBalance) : "Chưa có ví"} />
            <InfoPill label="Phiếu thu gần nhất" value={latestReceipt ? `${latestReceipt.code} · ${formatCurrency(Number(latestReceipt.amount))}` : "Chưa có phiếu"} />
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <StudentWalletCard summary={studentWallet} />
            <MakeupEntitlementCard entitlements={makeupEntitlements} />
          </div>
          <div className="grid gap-4 xl:grid-cols-[0.95fr_1.25fr]">
          <form className="neu-card rounded-3xl" onSubmit={submitEnrollment}>
            <SectionHeader icon={<BookOpenCheck className="h-5 w-5 text-brand-red" />} title="1. Ghi danh khóa/lớp" description="Chọn lớp và ngày bắt đầu, hệ thống tự tính buổi bé vào lớp." />
            <div className="content-border grid gap-3 p-5 md:grid-cols-2">
              <label className="block text-sm font-semibold text-stone-700 md:col-span-2">
                Khóa học
                <select className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none" value={enrollmentCourseId} onChange={(event) => { setEnrollmentCourseId(event.target.value); setEnrollmentClassId("") }} required>
                  <option value="" disabled>Chọn khóa học</option>
                  {activeCourseOptions.map((course) => <option key={course.id} value={course.id}>{course.name} · {course.totalSessions} buổi</option>)}
                </select>
              </label>
              <label className="block text-sm font-semibold text-stone-700">
                Xếp lớp
                <select className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none" value={enrollmentClassId} onChange={(event) => setEnrollmentClassId(event.target.value)}>
                  <option value="">Chưa xếp lớp</option>
                  {classOptions.map((klass) => <option key={klass.id} value={klass.id}>{klass.code ? `${klass.code} · ` : ""}{klass.name} · {klass.startTime}</option>)}
                </select>
              </label>
              <DetailInput label="Ngày bắt đầu" type="date" value={enrollmentStartDate} onChange={setEnrollmentStartDate} required />
              <DetailInput label="Học thử miễn phí dự kiến" type="number" min={0} value={enrollmentFreeTrialSessions} onChange={(value) => setEnrollmentFreeTrialSessions(toNonNegativeIntegerInput(value))} />
              <DetailInput
                label="Quỹ buổi ban đầu"
                type="number"
                min={0}
                value={enrollmentSessions}
                onChange={(value) => setEnrollmentSessions(toNonNegativeIntegerInput(value))}
                hint="Thường để 0. Chỉ nhập khi chuyển dữ liệu cũ hoặc muốn cấp buổi trước khi tạo phiếu thu."
                required
              />
              <div className="md:col-span-2 grid gap-3 md:grid-cols-5">
                <InfoPill label="Giá nguyên khóa" value={selectedEnrollmentCourse ? formatCurrency(selectedEnrollmentPrice) : "Chưa chọn"} />
                <InfoPill label="Tổng buổi khóa" value={selectedEnrollmentCourse ? `${selectedEnrollmentCourse.totalSessions} buổi` : "Chưa chọn"} />
                <InfoPill label="Đơn giá/buổi" value={selectedEnrollmentCourse ? formatCurrency(selectedEnrollmentUnitPrice) : "Chưa chọn"} />
                <InfoPill label="Bé sẽ bắt đầu từ buổi" value={selectedEnrollmentCourse ? `${enrollmentJoinPreview.joinSessionNumber}/${selectedEnrollmentCourse.totalSessions}` : "Chưa chọn"} />
                <InfoPill label="Số buổi tính phí còn lại" value={selectedEnrollmentCourse ? `${enrollmentSessionsFromJoin} buổi` : "Chưa chọn"} />
              </div>
              {enrollmentJoinPreview.warning ? (
                <p className="md:col-span-2 rounded-2xl border border-brand-red/10 bg-white/45 px-3 py-2 text-xs font-semibold text-stone-500">{enrollmentJoinPreview.warning}</p>
              ) : null}
            </div>
            <FormFooter loading={isSubmittingEnrollment} label="Ghi danh" loadingLabel="Đang ghi danh" disabled={!enrollmentCourseId} />
          </form>
	          <form className="neu-card rounded-3xl" onSubmit={submitReceipt}>
	            <SectionHeader icon={<CreditCard className="h-5 w-5 text-brand-red" />} title="2. Tạo phiếu thu" description="Chọn một hoặc nhiều khóa đã đăng ký, hệ thống tự tính buổi và tổng cần thanh toán." />
	            <div className="content-border space-y-4 p-5">
	              <div>
	                <p className="text-sm font-semibold text-stone-700">Cách thu học phí</p>
	                <select
	                  className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none"
	                  value={receiptBillingMode}
	                  onChange={(event) => {
	                    setReceiptBillingMode(event.target.value as ReceiptBillingMode)
	                    setReceiptAmount("")
	                    setIsReceiptAmountOverride(false)
	                    setIsWalletCreditManual(false)
	                  }}
	                >
	                  <option value="COURSE">Thu theo khóa / số buổi còn lại</option>
	                  <option value="MONTHLY">Thu theo tháng</option>
	                </select>
	                {isReceiptMonthlyBilling ? (
	                  <>
	                    <div className="mt-3 grid gap-3 md:grid-cols-2">
	                      <label>
	                        <span className="text-xs font-semibold text-stone-500">Tháng</span>
	                        <select
	                          className="neu-pressed mt-1 w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none"
	                          value={getMonthPart(receiptBillingMonth)}
	                          onChange={(event) => setReceiptBillingMonth(`${getYearPart(receiptBillingMonth)}-${event.target.value}`)}
	                        >
	                          {billingMonthChoices.map((choice) => (
	                            <option key={choice.value} value={choice.value}>{choice.label}</option>
	                          ))}
	                        </select>
	                      </label>
	                      <label>
	                        <span className="text-xs font-semibold text-stone-500">Năm</span>
	                        <select
	                          className="neu-pressed mt-1 w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none"
	                          value={getYearPart(receiptBillingMonth)}
	                          onChange={(event) => setReceiptBillingMonth(`${event.target.value}-${getMonthPart(receiptBillingMonth)}`)}
	                        >
	                          {receiptBillingYearOptions.map((year) => (
	                            <option key={year} value={year}>{year}</option>
	                          ))}
	                        </select>
	                      </label>
	                    </div>
	                    <span className="mt-1 block text-xs text-stone-500">Hệ thống đếm các buổi trong tháng này từ lịch lớp, bỏ qua buổi nghỉ/hủy.</span>
	                  </>
	                ) : null}
	              </div>
	              <div>
	                <p className="text-sm font-semibold text-stone-700">Khóa cần thu</p>
                <div className="mt-2 grid gap-2">
                  {activeStudentCourses(student).length ? activeStudentCourses(student).map((course) => {
                    const selected = receiptLines.some((line) => line.enrollmentId === course.enrollmentId)

                    return (
                      <div key={course.enrollmentId} className={`neu-list-item flex items-center justify-between gap-3 rounded-2xl p-3 text-left ${selected ? "border-brand-red/40 bg-white/70" : ""}`}>
                        <button type="button" onClick={() => toggleReceiptLine(course)} className="min-w-0 flex-1 text-left">
                          <span className="block text-sm font-semibold text-brand-ink">{course.courseName}</span>
                          <span className="text-xs text-stone-500">{course.courseSubject} · còn {course.sessionsRemaining} buổi · giá khóa {formatCurrency(Number(course.coursePrice))}</span>
                          <span className="mt-1 block text-xs text-stone-500">
                            {course.className ? `Lớp ${course.className}` : "Chưa xếp lớp"}
                            {course.classProgress ? ` · ${course.classProgress.label}` : ""}
                            {` · đã học ${course.sessionsUsed}/${course.sessionsBought} buổi`}
                          </span>
                        </button>
                        <div className="flex shrink-0 items-center gap-2">
                          <button type="button" onClick={() => openTransferDialog(course)} className="rounded-full border border-brand-red/15 px-3 py-1 text-xs font-semibold text-brand-red">
                            <Repeat2 className="mr-1 inline h-3.5 w-3.5" />
                            Chuyển
                          </button>
                          <button type="button" onClick={() => setEditingEnrollment(toEnrollmentEditDraft(course))} className="rounded-full border border-brand-red/15 px-3 py-1 text-xs font-semibold text-brand-red">
                            <Pencil className="mr-1 inline h-3.5 w-3.5" />
                            Sửa
                          </button>
                          <button type="button" onClick={() => toggleReceiptLine(course)} className={`rounded-full border px-3 py-1 text-xs font-semibold ${selected ? "border-brand-red bg-brand-red text-white" : "border-brand-red/15 text-brand-red"}`}>{selected ? "Đã chọn" : "Chọn"}</button>
                        </div>
                      </div>
                    )
                  }) : <EmptyState text="Chưa có khóa đang hoạt động." />}
                </div>
              </div>

              {receiptLineSummaries.length ? (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-stone-700">Tính phí</p>
                  {receiptLineSummaries.map((summary) => (
                    <article key={summary.line.enrollmentId} className="rounded-2xl border border-brand-red/10 bg-white/35 p-4">
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
	                        <div>
	                          <p className="font-semibold text-brand-ink">{summary.course?.courseName ?? "Khóa đã đăng ký"}</p>
	                          <p className="mt-1 text-xs text-stone-500">Đơn giá {formatCurrency(summary.unitPrice)} · thành tiền {formatCurrency(summary.amount)}</p>
	                          <p className="mt-1 text-xs text-stone-500">
	                            {isReceiptMonthlyBilling
	                              ? (summary.monthlySessions === undefined
	                                ? "Chưa có lịch lớp trong kỳ, hệ thống fallback theo quỹ buổi khóa."
	                                : `Kỳ ${getBillingPeriodForMonth(receiptBillingMonth).label}: ${summary.monthlySessions} buổi lịch lớp, đã thu ${summary.billedThisMonth} buổi.`)
	                              : `Thu theo khóa / số buổi còn lại: ${summary.billableSessions} buổi tính phí.`}
	                          </p>
	                        </div>
                        <p className="text-sm font-semibold text-brand-red">{summary.remainingAfterReceipt} buổi còn sau thu</p>
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-5">
                        <DetailInput label="Học thử" type="number" min={0} value={summary.line.freeTrialSessions} onChange={(value) => updateReceiptLine(summary.line.enrollmentId, { freeTrialSessions: toNonNegativeIntegerInput(value) })} />
                        <DetailInput label="Đã học trước" type="number" min={0} value={summary.line.paidSessionsBeforeReceipt} onChange={(value) => updateReceiptLine(summary.line.enrollmentId, { paidSessionsBeforeReceipt: toNonNegativeIntegerInput(value) })} />
                        <label className="block text-sm font-semibold text-stone-700">
                          Số buổi tính phí
                          <input
                            className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none placeholder:text-stone-400"
                            type="number"
                            min={0}
                            value={summary.line.isBillableOverride ? summary.line.billableSessions : summary.billableSessions}
                            readOnly={!summary.line.isBillableOverride}
                            onClick={() => {
                              if (!summary.line.isBillableOverride) setPendingBillableEnrollmentId(summary.line.enrollmentId)
                            }}
                            onChange={(event) => updateReceiptLine(summary.line.enrollmentId, { billableSessions: toNonNegativeIntegerInput(event.target.value) })}
                          />
                          <span className="mt-1 block text-xs text-stone-500">{summary.line.isBillableOverride ? "Đã sửa tay" : "Tự tính từ khóa đã đăng ký"}</span>
                        </label>
                        <div className="group relative md:col-span-2">
                          <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                            <label className="block text-sm font-semibold text-stone-700">
                              Giảm giá
                              <input
                                className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none placeholder:text-stone-400"
                                value={summary.line.discountInput}
                                onChange={(event) => updateReceiptLine(summary.line.enrollmentId, { discountInput: event.target.value })}
                                onBlur={(event) => updateReceiptLine(summary.line.enrollmentId, { discountInput: formatDiscountInput(event.target.value) })}
                                placeholder="10 hoặc 100000"
                              />
                            </label>
                            <button
                              type="button"
                              className="mt-7 rounded-2xl border border-brand-red/15 px-3 py-2 text-xs font-semibold text-brand-red"
                              onClick={() => updateReceiptLine(summary.line.enrollmentId, { isExtraDiscountVisible: !summary.line.isExtraDiscountVisible, extraDiscountInput: summary.line.isExtraDiscountVisible ? "" : summary.line.extraDiscountInput })}
                            >
                              {summary.line.isExtraDiscountVisible ? "Bỏ ưu đãi" : "Thêm ưu đãi"}
                            </button>
                          </div>
                          {summary.line.isExtraDiscountVisible ? (
                            <label className="mt-2 block text-sm font-semibold text-stone-700">
                              Ưu đãi thêm
                              <input
                                className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none placeholder:text-stone-400"
                                value={summary.line.extraDiscountInput}
                                onChange={(event) => updateReceiptLine(summary.line.enrollmentId, { extraDiscountInput: event.target.value })}
                                onBlur={(event) => updateReceiptLine(summary.line.enrollmentId, { extraDiscountInput: formatDiscountInput(event.target.value) })}
                                placeholder="Ví dụ: 100000"
                              />
                            </label>
                          ) : null}
                          <FieldHint>Nhập 0-100 để hệ thống hiểu là %, ví dụ 10 thành 10%. Nhập lớn hơn 100 sẽ thành tiền, ví dụ 100000 thành 100.000đ.</FieldHint>
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-stone-500">{summary.discount.label}</p>
                    </article>
                  ))}
                </div>
              ) : null}

              <div className="rounded-2xl border border-brand-red/10 bg-white/35 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-stone-700">Cần thu riêng</p>
                    <p className="mt-1 text-xs text-stone-500">Phụ đạo theo giờ hoặc khoản linh động, không cộng vào quỹ buổi khóa.</p>
                  </div>
                  <button type="button" onClick={addReceiptExtraLine} className="glass-button-secondary inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold">
                    <Plus className="h-3.5 w-3.5" />
                    Thêm phụ đạo
                  </button>
                </div>
                {receiptExtraLineSummaries.length ? (
                  <div className="mt-4 space-y-3">
                    {receiptExtraLineSummaries.map((summary) => (
                      <article key={summary.line.id} className="rounded-2xl border border-brand-red/10 bg-white/45 p-3">
                        <div className="grid gap-3 md:grid-cols-[0.8fr_1.2fr_0.7fr_1fr_auto]">
                          <label className="block text-sm font-semibold text-stone-700">
                            Loại
                            <select
                              className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-3 py-3 text-sm text-brand-ink outline-none"
                              value={summary.line.type}
                              onChange={(event) => updateReceiptExtraLine(summary.line.id, { type: event.target.value as ReceiptExtraDraftLine["type"] })}
                            >
                              <option value="TUTORING">Phụ đạo</option>
                              <option value="OTHER">Thu riêng</option>
                            </select>
                          </label>
                          <DetailInput label="Mô tả" value={summary.line.description} onChange={(value) => updateReceiptExtraLine(summary.line.id, { description: value })} />
                          <DetailInput label="Số giờ/sl" type="number" min={0} value={summary.line.quantity} onChange={(value) => updateReceiptExtraLine(summary.line.id, { quantity: value })} />
                          <label className="block text-sm font-semibold text-stone-700">
                            Đơn giá
                            <input
                              className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-3 py-3 text-sm text-brand-ink outline-none placeholder:text-stone-400"
                              value={summary.line.unitPrice}
                              onChange={(event) => updateReceiptExtraLine(summary.line.id, { unitPrice: formatMoneyInput(event.target.value) })}
                              placeholder="Ví dụ: 200000"
                            />
                          </label>
                          <button type="button" onClick={() => removeReceiptExtraLine(summary.line.id)} className="mt-7 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-brand-red/15 text-brand-red">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
                          <DetailInput label="Ghi chú" value={summary.line.note} onChange={(value) => updateReceiptExtraLine(summary.line.id, { note: value })} />
                          <InfoPill label="Thành tiền" value={formatCurrency(summary.amount)} />
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 rounded-2xl border border-brand-red/10 px-3 py-3 text-xs font-semibold text-stone-500">Chưa có khoản thu riêng.</p>
                )}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="block text-sm font-semibold text-stone-700">
                  Tổng phiếu trước credit
                  <input
                    className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none placeholder:text-stone-400"
                    value={isReceiptAmountOverride ? receiptAmount : formatMoneyInput(Math.round(payableAmount))}
                    readOnly={!isReceiptAmountOverride}
                    onClick={() => {
                      if (!isReceiptAmountOverride) setIsConfirmingReceiptAmount(true)
                    }}
                    onChange={(event) => {
                      setIsReceiptAmountOverride(true)
                      setReceiptAmount(formatMoneyInput(event.target.value))
                    }}
                    placeholder="Nhập số tiền thực thu"
                  />
                  <span className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    {isReceiptAmountOverride ? (
                      <span className="font-semibold text-brand-red">{receiptAmount ? "Đã chỉnh tay" : "Để trống sẽ dùng số tự tính"}</span>
                    ) : (
                      <span className="text-stone-500">Tự tính từ học phí khóa và khoản thu riêng</span>
                    )}
                    {isReceiptAmountOverride ? (
                      <button
                        type="button"
                        className="font-semibold text-brand-red underline-offset-2 hover:underline"
                        onClick={() => {
                          setReceiptAmount("")
                          setIsReceiptAmountOverride(false)
                        }}
                      >
                        Dùng số tự tính
                      </button>
                    ) : null}
                  </span>
                  {receiptAmountSuggestions.length ? (
                    <span className="mt-2 flex flex-wrap gap-2">
                      {receiptAmountSuggestions.map((suggestion) => (
                        <button key={suggestion} type="button" onClick={() => setReceiptAmount(formatMoneyInput(suggestion))} className="rounded-full border border-brand-red/15 px-3 py-1 text-xs font-semibold text-brand-red">
                          {formatMoneyInput(suggestion)}
                        </button>
                      ))}
                    </span>
                  ) : null}
                </label>
                <label className="block text-sm font-semibold text-stone-700">
                  Dùng credit ví
                  <input
                    className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none placeholder:text-stone-400 disabled:cursor-not-allowed disabled:opacity-60"
                    value={isWalletCreditManual ? walletCreditInput : (suggestedWalletCreditAmount > 0 ? formatMoneyInput(Math.round(suggestedWalletCreditAmount)) : "")}
                    onChange={(event) => {
                      setIsWalletCreditManual(true)
                      setWalletCreditInput(formatMoneyInput(event.target.value))
                    }}
                    placeholder="0"
                    disabled={walletBalance <= 0}
                  />
                  <span className="mt-1 block text-xs text-stone-500">
                    Số dư {formatCurrency(walletBalance)} · gợi ý tự trừ {formatCurrency(suggestedWalletCreditAmount)}
                  </span>
                </label>
                <div className="rounded-2xl border border-brand-red/10 bg-white/45 p-4 text-sm md:col-span-2">
                  <div className="grid gap-3 md:grid-cols-4">
                    <InfoPill label="Học phí khóa" value={formatCurrency(coursePayableAmount)} />
                    <InfoPill label="Cần thu riêng" value={formatCurrency(extraPayableAmount)} />
                    <InfoPill label="Mẹ cần bù" value={formatCurrency(actualReceiptPaymentAmount)} />
                    <InfoPill label="Credit còn lại" value={formatCurrency(Math.max(0, walletBalance - walletCreditAmount))} />
                  </div>
                  <p className="mt-3 text-xs font-semibold text-stone-500">Credit dùng: {formatCurrency(walletCreditAmount)} · Tổng trước credit: {formatCurrency(actualReceiptAmount)}</p>
                </div>
                <label className="block text-sm font-semibold text-stone-700">
                  Phương thức
                  <select className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none" value={receiptMethod} onChange={(event) => setReceiptMethod(event.target.value as PaymentMethodKey)}>
                    {paymentMethods.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                  </select>
                </label>
                <label className="block text-sm font-semibold text-stone-700 md:col-span-2">
                  Ghi chú phiếu thu
                  <input className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none placeholder:text-stone-400" value={receiptNote} onChange={(event) => setReceiptNote(event.target.value)} placeholder="Ví dụ: Học phí FUN + Robotics tháng này, ưu đãi anh chị em..." />
                </label>
              </div>
              {lastReceipt ? (
                <Link href={`/receipts/${lastReceipt.id}/print`} target="_blank" className="glass-button-secondary inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold">
                  <Printer className="h-4 w-4" />
                  In / lưu PDF phiếu {lastReceipt.code}
                </Link>
              ) : null}
              {receiptValidationErrors.length ? (
                <div className="rounded-2xl border border-brand-red/15 bg-white/55 p-3 text-xs font-semibold text-brand-red">
                  {receiptValidationErrors.map((message) => <p key={message}>{message}</p>)}
                </div>
              ) : null}
            </div>
            <FormFooter loading={isSubmittingReceipt} label="Xác nhận đóng tiền" loadingLabel="Đang thu" disabled={!receiptLineSummaries.length || actualReceiptAmount < 0 || receiptValidationErrors.length > 0} />
          </form>
          </div>
          <EnrollmentTransferHistory transfers={student.enrollmentTransfers} />
          <ReceiptHistoryCard receipts={studentReceipts} />
        </section>
      ) : null}

      {activeTab === "journal" ? (
        <section className="space-y-4">
          <div className="neu-card rounded-3xl p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-brand-red">Media review</p>
                <h2 className="mt-1 text-xl font-semibold text-brand-ink">Ảnh & nhật ký phụ huynh</h2>
                <p className="mt-1 text-sm text-stone-600">Duyệt ảnh nháp của bé trước khi hiển thị trong cổng phụ huynh.</p>
                {!student.permissions.canPublishPhotos ? (
                  <p className="mt-2 rounded-2xl border border-brand-red/10 bg-white/55 px-3 py-2 text-xs font-semibold text-stone-500">
                    Tài khoản này chỉ xem/sửa ghi chú ảnh, không có quyền gửi ảnh cho phụ huynh.
                  </p>
                ) : null}
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs font-semibold text-stone-600">
                <span className="rounded-2xl border border-brand-red/10 px-3 py-2">{student.photos.length} ảnh</span>
                <span className="rounded-2xl border border-brand-red/10 px-3 py-2">{student.photos.filter((photo) => !photo.isPublished).length} nháp</span>
                <span className="rounded-2xl border border-brand-red/10 px-3 py-2">{student.photos.filter((photo) => photo.isPublished).length} đã gửi</span>
              </div>
            </div>

            <div className="content-border mt-4 grid gap-3 pt-4 lg:grid-cols-[auto_minmax(160px,220px)_repeat(2,minmax(140px,180px))_auto] lg:items-end">
              <div className="flex flex-wrap gap-2">
                {photoReviewFilters.map((filter) => (
                  <button
                    key={filter.key}
                    type="button"
                    className={`rounded-2xl border px-4 py-2 text-xs font-semibold ${photoReviewFilter === filter.key ? "border-brand-red bg-brand-red text-white" : "border-brand-red/15 text-stone-600"}`}
                    onClick={() => setPhotoReviewFilter(filter.key)}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
              <label className="block text-xs font-semibold text-stone-600">
                Khóa học
                <select
                  className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-3 py-2 text-sm text-brand-ink outline-none"
                  value={photoCourseFilter}
                  onChange={(event) => setPhotoCourseFilter(event.target.value)}
                >
                  <option value="ALL">Tất cả khóa</option>
                  {photoCourseOptions.map((courseName) => (
                    <option key={courseName} value={courseName}>{courseName}</option>
                  ))}
                </select>
              </label>
              <DetailInput label="Từ ngày" type="date" value={photoDateFrom} onChange={setPhotoDateFrom} />
              <DetailInput label="Đến ngày" type="date" value={photoDateTo} onChange={setPhotoDateTo} />
              <button
                type="button"
                className="rounded-2xl border border-brand-red/15 px-4 py-3 text-xs font-semibold text-brand-red"
                onClick={() => {
                  setPhotoReviewFilter("ALL")
                  setPhotoCourseFilter("ALL")
                  setPhotoDateFrom("")
                  setPhotoDateTo("")
                }}
              >
                Xóa lọc
              </button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredPhotos.length ? filteredPhotos.map((photo) => (
              <article key={photo.id} className="neu-card overflow-hidden rounded-3xl">
                <a href={photo.url} target="_blank" rel="noreferrer" className="block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.url} alt={photo.caption || `Ảnh ${student.name}`} className="h-52 w-full object-cover" />
                </a>
                <div className="space-y-3 p-4">
                  <div className="flex flex-wrap gap-2 text-xs font-semibold">
                    <span className={`rounded-full border px-2 py-1 ${photo.isPublished ? "border-emerald-200 text-emerald-700" : "border-brand-red/15 text-stone-500"}`}>
                      {photo.isPublished ? "Phụ huynh thấy" : "Nháp"}
                    </span>
                    {photo.isFeatured ? <span className="rounded-full border border-amber-200 px-2 py-1 text-amber-700">Nổi bật</span> : null}
                    {photo.sentToParentAt ? <span className="rounded-full border border-brand-red/10 px-2 py-1 text-stone-500">Đã gửi {formatDate(photo.sentToParentAt)}</span> : null}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-brand-red">{formatDate(photo.takenAt)}</p>
                    <p className="mt-1 text-sm font-semibold text-brand-ink">{photo.className ?? "Chưa gắn lớp"}</p>
                    <p className="mt-1 text-xs text-stone-500">
                      {[photo.courseName, photo.attendanceStatus ? attendanceStatusLabels[photo.attendanceStatus] : undefined, photo.createdByName ? `Upload bởi ${photo.createdByName}` : undefined].filter(Boolean).join(" · ") || "Ảnh học viên"}
                    </p>
                  </div>
                  <textarea
                    className="neu-pressed min-h-20 w-full resize-none rounded-2xl bg-transparent px-3 py-2 text-sm text-brand-ink outline-none placeholder:text-stone-400"
                    value={photoCaptionDrafts[photo.id] ?? ""}
                    onChange={(event) => setPhotoCaptionDrafts((current) => ({ ...current, [photo.id]: event.target.value }))}
                    placeholder="Caption gửi phụ huynh..."
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={photoSavingId === photo.id}
                      className="neu-list-item inline-flex items-center justify-center gap-1 rounded-2xl px-3 py-2 text-xs font-semibold text-stone-600 hover:text-brand-red disabled:opacity-50"
                      onClick={() => void patchStudentPhoto(photo.id, { caption: photoCaptionDrafts[photo.id] ?? "" })}
                    >
                      <Save className="h-3.5 w-3.5" />
                      Lưu caption
                    </button>
                    {student.permissions.canPublishPhotos ? (
                      <>
                        <button
                          type="button"
                          disabled={photoSavingId === photo.id}
                          className="neu-list-item inline-flex items-center justify-center gap-1 rounded-2xl px-3 py-2 text-xs font-semibold text-stone-600 hover:text-brand-red disabled:opacity-50"
                          onClick={() => void patchStudentPhoto(photo.id, { isFeatured: !photo.isFeatured })}
                        >
                          <Star className="h-3.5 w-3.5" />
                          {photo.isFeatured ? "Bỏ nổi bật" : "Nổi bật"}
                        </button>
                        <button
                          type="button"
                          disabled={photoSavingId === photo.id}
                          className="neu-list-item inline-flex items-center justify-center gap-1 rounded-2xl px-3 py-2 text-xs font-semibold text-stone-600 hover:text-brand-red disabled:opacity-50"
                          onClick={() => void patchStudentPhoto(photo.id, photo.isPublished ? { isPublished: false } : { markSent: true })}
                        >
                          {photo.isPublished ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          {photo.isPublished ? "Ẩn khỏi PH" : "Publish"}
                        </button>
                        <button
                          type="button"
                          disabled={photoSavingId === photo.id || photo.isPublished}
                          className="neu-list-item inline-flex items-center justify-center gap-1 rounded-2xl px-3 py-2 text-xs font-semibold text-stone-600 hover:text-brand-red disabled:opacity-50"
                          onClick={() => void patchStudentPhoto(photo.id, { markSent: true })}
                        >
                          <Send className="h-3.5 w-3.5" />
                          Gửi PH
                        </button>
                        <button
                          type="button"
                          disabled={photoSavingId === photo.id}
                          className="neu-list-item col-span-2 inline-flex items-center justify-center gap-1 rounded-2xl px-3 py-2 text-xs font-semibold text-brand-red disabled:opacity-50"
                          onClick={() => void deleteStudentPhoto(photo.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Xóa ảnh
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              </article>
            )) : (
              <p className="neu-card rounded-3xl p-6 text-sm text-stone-500 md:col-span-2 xl:col-span-3">
                Chưa có ảnh phù hợp bộ lọc. Ảnh bé được upload từ màn hình điểm danh sẽ xuất hiện ở đây dưới trạng thái nháp.
              </p>
            )}
          </div>
        </section>
      ) : null}

      {activeTab === "parent-account" ? (
        <section className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
          <div className="neu-card rounded-3xl p-5">
            <div className="flex items-start gap-4">
              <div className="neu-pressed flex h-12 w-12 items-center justify-center rounded-2xl">
                <KeyRound className="h-6 w-6 text-brand-red" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-brand-red">Parent account</p>
                <h2 className="mt-1 text-2xl font-semibold text-brand-ink">{student.parentAccount.canLogin ? "Đã kích hoạt" : "Chưa kích hoạt"}</h2>
                <p className="mt-2 text-sm text-stone-600">Phụ huynh đăng nhập ở `/login`, hệ thống tự chuyển sang cổng phụ huynh.</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <InfoPill label="Số điện thoại đăng nhập" value={student.parentAccount.phone} />
              <InfoPill label="Email" value={student.parentAccount.email ?? "Chưa có email"} />
              <InfoPill label="Trạng thái" value={student.parentAccount.isActive ? "Active" : "Inactive"} />
              <InfoPill label="Mật khẩu phụ huynh" value={usesTemporaryParentPassword ? "Tạm thời khi reset" : "SĐT phụ huynh"} />
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" disabled={isUpdatingParentAccount || student.parentAccount.canLogin} onClick={() => void updateParentAccount("activate")} className="glass-button-primary inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60">
                <ShieldCheck className="h-4 w-4" />
                Kích hoạt tài khoản
              </button>
              <button type="button" disabled={isUpdatingParentAccount} onClick={() => void updateParentAccount("reset_default_password")} className="glass-button-secondary inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold">
                <RotateCcw className="h-4 w-4" />
                Đặt lại mật khẩu
              </button>
            </div>
          </div>
          <div className="neu-card rounded-3xl p-5">
            <h2 className="font-semibold text-brand-ink">Hướng dẫn gửi phụ huynh</h2>
            <div className="mt-4 rounded-2xl border border-brand-red/10 bg-white/45 p-4 text-sm text-stone-700">
              <p>Link: http://localhost:3000/login</p>
              <p className="mt-2">Số điện thoại: {student.parentAccount.phone}</p>
              <p>
                Mật khẩu:{" "}
                {temporaryParentPassword ?? (usesTemporaryParentPassword ? "bấm đặt lại mật khẩu để tạo mã tạm thời" : "số điện thoại phụ huynh")}
              </p>
              <p className="mt-2 text-xs text-stone-500">Khi account active, phụ huynh đăng nhập sẽ được chuyển thẳng sang `/parent`.</p>
            </div>
          </div>
        </section>
      ) : null}

      <ConfirmDialog
        open={Boolean(pendingBillableEnrollmentId)}
        title="Sửa số buổi tính phí?"
        description="Số buổi này đang được hệ thống tự tính từ khóa đã đăng ký. Chỉ sửa tay khi trường hợp thu học phí có ngoại lệ."
        confirmLabel="Cho phép sửa"
        onCancel={() => setPendingBillableEnrollmentId(null)}
        onConfirm={confirmBillableOverride}
      />

      <ConfirmDialog
        open={isConfirmingReceiptAmount}
        title="Sửa số tiền thanh toán?"
        description="Số tiền phụ huynh cần thanh toán đang được tính tự động từ các dòng khóa và giảm giá. Nếu sửa tay, hệ thống sẽ lưu tổng phiếu theo số tiền bạn nhập."
        confirmLabel="Cho phép sửa"
        onCancel={() => setIsConfirmingReceiptAmount(false)}
        onConfirm={confirmReceiptAmountOverride}
      />

      {isConfirmingPayment ? (
        <DialogShell
          eyebrow="Preview phiếu thu"
          title="Xác nhận đóng tiền"
          description="Kiểm tra học phí khóa, khoản thu riêng, credit và thực thu trước khi lưu phiếu."
          onClose={() => setIsConfirmingPayment(false)}
          closeLabel="Đóng xác nhận đóng tiền"
          size="lg"
          bodyClassName="p-0"
          footer={
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setIsConfirmingPayment(false)} className="glass-button-secondary px-4 py-3 text-sm font-semibold">Hủy</button>
              <button
                type="button"
                disabled={isSubmittingReceipt || receiptValidationErrors.length > 0}
                onClick={() => void confirmReceiptPayment()}
                className="glass-button-primary inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
              >
                <CreditCard className="h-4 w-4" />
                {isSubmittingReceipt ? "Đang lưu phiếu" : "Lưu phiếu thu"}
              </button>
            </div>
          }
        >
          <div className="content-border space-y-4 p-5">
	            <div className="grid gap-3 md:grid-cols-5">
	              <InfoPill label="Cách thu" value={isReceiptMonthlyBilling ? getBillingPeriodForMonth(receiptBillingMonth).label.replace("Học phí ", "") : "Theo khóa"} />
	              <InfoPill label="Học phí khóa" value={formatCurrency(coursePayableAmount)} />
	              <InfoPill label="Cần thu riêng" value={formatCurrency(extraPayableAmount)} />
	              <InfoPill label="Credit dùng" value={formatCurrency(walletCreditAmount)} />
	              <InfoPill label="Thực thu" value={formatCurrency(actualReceiptPaymentAmount)} />
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-2xl border border-brand-red/10 bg-white/45 p-4">
                <p className="text-sm font-semibold text-brand-ink">Học phí khóa</p>
                <div className="mt-3 space-y-2 text-sm text-stone-600">
                  {receiptLineSummaries.map((summary) => (
                    <div key={summary.line.enrollmentId} className="flex justify-between gap-3">
	                      <span>{summary.course?.courseName ?? "Khóa đã đăng ký"} · {summary.billableSessions} buổi{isReceiptMonthlyBilling ? ` · ${getBillingPeriodForMonth(receiptBillingMonth).label}` : ""}</span>
                      <strong className="text-brand-ink">{formatCurrency(summary.amount)}</strong>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-brand-red/10 bg-white/45 p-4">
                <p className="text-sm font-semibold text-brand-ink">Cần thu riêng</p>
                <div className="mt-3 space-y-2 text-sm text-stone-600">
                  {receiptExtraLineSummaries.length ? receiptExtraLineSummaries.map((summary) => (
                    <div key={summary.line.id} className="flex justify-between gap-3">
                      <span>{summary.line.description} · {summary.quantity} x {formatCurrency(summary.unitPrice)}</span>
                      <strong className="text-brand-ink">{formatCurrency(summary.amount)}</strong>
                    </div>
                  )) : <p className="text-xs font-semibold text-stone-500">Không có khoản thu riêng.</p>}
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-brand-red/10 bg-white/45 p-4 text-sm text-stone-600">
              <div className="grid gap-2 md:grid-cols-2">
                <p>Phương thức: <strong className="text-brand-ink">{paymentMethodLabels[receiptMethod]}</strong></p>
                <p>Tổng trước credit: <strong className="text-brand-ink">{formatCurrency(actualReceiptAmount)}</strong></p>
                <p>Credit còn lại sau phiếu: <strong className="text-brand-ink">{formatCurrency(Math.max(0, walletBalance - walletCreditAmount))}</strong></p>
                <p>Ghi chú: <strong className="text-brand-ink">{receiptNote.trim() || "Không có"}</strong></p>
              </div>
            </div>
          </div>
        </DialogShell>
      ) : null}

      <ConfirmDialog
        open={isConfirmingEnrollmentDelete}
        title="Xóa hoặc hủy ghi danh?"
        description="Nếu khóa chưa có phiếu thu, điểm danh hoặc đánh giá, hệ thống sẽ xóa ghi danh. Nếu đã phát sinh dữ liệu, hệ thống chỉ hủy ghi danh để giữ lịch sử đối soát."
        confirmLabel={isDeletingEnrollment ? "Đang xử lý" : "Xác nhận"}
        onCancel={() => setIsConfirmingEnrollmentDelete(false)}
        onConfirm={() => {
          if (!isDeletingEnrollment) void deleteOrCancelEnrollment()
        }}
      />

      <LearningDetailDialog target={selectedLearningDetail} onClose={() => setSelectedLearningDetail(null)} />

      {transferDraft ? (
        <DialogFormShell
          eyebrow="Đối soát chuyển lớp"
          title={`Chuyển ${transferSourceCourse?.courseName ?? "khóa/lớp"}`}
          description="Hệ thống tự tính credit từ số buổi còn lại và ghi vào ví học viên khi chuyển sang khóa khác."
          onClose={() => setTransferDraft(null)}
          closeLabel="Đóng chuyển lớp/khóa"
          onSubmit={submitTransfer}
          size="lg"
          bodyClassName="p-0"
          footer={
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setTransferDraft(null)} className="glass-button-secondary px-4 py-3 text-sm font-semibold">Hủy</button>
              <button type="submit" disabled={isSubmittingTransfer || !transferDraft.toCourseId || !transferDraft.reason.trim()} className="glass-button-primary inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60">
                <Repeat2 className="h-4 w-4" />
                {isSubmittingTransfer ? "Đang chuyển" : "Xác nhận chuyển"}
              </button>
            </div>
          }
        >
          <div className="content-border space-y-4 p-5">
            <div className="grid gap-3 md:grid-cols-4">
              <InfoPill label="Đã mua" value={`${transferSourceCourse?.sessionsBought ?? 0} buổi`} />
              <InfoPill label="Đã học" value={`${transferSourceCourse?.sessionsUsed ?? 0} buổi`} />
              <InfoPill label="Còn lại" value={`${transferRemainingSessions} buổi`} />
              <InfoPill label="Credit dự kiến" value={formatCurrency(transferCreditPreview)} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block text-sm font-semibold text-stone-700">
                Khóa/lớp mới
                <select
                  className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none"
                  value={transferDraft.toCourseId}
                  onChange={(event) => setTransferDraft({ ...transferDraft, toCourseId: event.target.value, toClassId: "" })}
                  required
                >
                  {activeCourseOptions.map((course) => (
                    <option key={course.id} value={course.id}>{course.name} · {course.totalSessions} buổi · {formatCurrency(Number(course.price))}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-semibold text-stone-700">
                Xếp lớp mới
                <select
                  className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none"
                  value={transferDraft.toClassId}
                  onChange={(event) => setTransferDraft({ ...transferDraft, toClassId: event.target.value })}
                  required={!isCourseTransfer}
                >
                  <option value="">{isCourseTransfer ? "Chưa xếp lớp" : "Chọn lớp mới"}</option>
                  {transferClassOptions.map((klass) => (
                    <option key={klass.id} value={klass.id}>{klass.code ? `${klass.code} · ` : ""}{klass.name} · {klass.startTime}</option>
                  ))}
                </select>
              </label>
              <DetailInput label="Ngày bắt đầu lớp/khóa mới" type="date" value={transferDraft.startDate} onChange={(value) => setTransferDraft({ ...transferDraft, startDate: value })} />
              <label className="block text-sm font-semibold text-stone-700">
                Lý do chuyển
                <input
                  className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none placeholder:text-stone-400"
                  value={transferDraft.reason}
                  onChange={(event) => setTransferDraft({ ...transferDraft, reason: event.target.value })}
                  placeholder="Ví dụ: đổi lịch học, chuyển từ FUN sang Robotics..."
                  required
                />
              </label>
            </div>
            <div className="rounded-2xl border border-brand-red/10 bg-white/45 p-4">
              <div className="grid gap-3 md:grid-cols-4">
                <InfoPill label="Loại chuyển" value={isCourseTransfer ? "Chuyển khóa" : "Đổi lớp cùng khóa"} />
                <InfoPill label="Học phí khóa mới" value={transferTargetCourse ? formatCurrency(transferTargetPrice) : "Chưa chọn"} />
                <InfoPill label="Credit sẽ ghi ví" value={formatCurrency(transferCreditPreview)} />
                <InfoPill label="Mẹ dự kiến bù" value={isCourseTransfer ? formatCurrency(transferTopUpPreview) : "Không phát sinh"} />
              </div>
              <p className="mt-3 text-xs text-stone-500">
                Nếu chuyển khóa, enrollment cũ sẽ tạm dừng, lớp cũ vẫn giữ lịch sử không hoạt động, credit vào ví và phiếu thu khóa mới sẽ tự trừ credit.
              </p>
            </div>
          </div>
        </DialogFormShell>
      ) : null}

      {editingEnrollment ? (
        <DialogFormShell
          eyebrow="Khóa đã đăng ký"
          title={`Sửa ${editingCourse?.courseName ?? "khóa"}`}
          description="Dữ liệu này là nền để phiếu thu tự tính số buổi."
          onClose={() => setEditingEnrollment(null)}
          closeLabel="Đóng sửa khóa đã đăng ký"
          onSubmit={submitEnrollmentEdit}
          size="md"
          bodyClassName="p-0"
          footer={
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={isUpdatingEnrollment || isDeletingEnrollment}
                onClick={() => setIsConfirmingEnrollmentDelete(true)}
                className="mr-auto rounded-2xl border border-brand-red/25 bg-white/45 px-4 py-3 text-sm font-semibold text-brand-red transition-colors hover:bg-brand-red hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                Xóa/Hủy ghi danh
              </button>
              <button type="button" onClick={() => setEditingEnrollment(null)} className="glass-button-secondary px-4 py-3 text-sm font-semibold">Hủy</button>
              <button type="submit" disabled={isUpdatingEnrollment} className="glass-button-primary inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60">
                <Save className="h-4 w-4" />
                {isUpdatingEnrollment ? "Đang lưu" : "Lưu khóa"}
              </button>
            </div>
          }
        >
            <div className="content-border grid gap-3 p-5 md:grid-cols-2">
              <label className="block text-sm font-semibold text-stone-700 md:col-span-2">
                Xếp lớp
                <select className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none" value={editingEnrollment.classId} onChange={(event) => setEditingEnrollment({ ...editingEnrollment, classId: event.target.value })}>
                  <option value="">Chưa xếp lớp</option>
                  {editingClassOptions.map((klass) => <option key={klass.id} value={klass.id}>{klass.code ? `${klass.code} · ` : ""}{klass.name} · {klass.startTime}</option>)}
                </select>
              </label>
              <DetailInput label="Ngày bắt đầu" type="date" value={editingEnrollment.startDate} onChange={(value) => setEditingEnrollment({ ...editingEnrollment, startDate: value })} />
              <DetailInput label="Học thử miễn phí dự kiến" type="number" min={0} value={editingEnrollment.freeTrialSessions} onChange={(value) => setEditingEnrollment({ ...editingEnrollment, freeTrialSessions: toNonNegativeIntegerInput(value) })} />
              <DetailInput
                label="Quỹ buổi hiện có"
                type="number"
                min={0}
                value={editingEnrollment.sessionsBought}
                onChange={(value) => setEditingEnrollment({ ...editingEnrollment, sessionsBought: toNonNegativeIntegerInput(value) })}
                hint="Tổng số buổi đang được cấp cho khóa này, gồm dữ liệu cũ và các phiếu thu đã tạo."
              />
              <DetailInput label="Số buổi đã học" type="number" min={0} value={editingEnrollment.sessionsUsed} onChange={(value) => setEditingEnrollment({ ...editingEnrollment, sessionsUsed: toNonNegativeIntegerInput(value) })} />
              <div className="grid gap-3 md:col-span-2 md:grid-cols-3">
                <InfoPill label="Buổi hiện tại" value={`${editingEnrollment.joinSessionNumber || 1}`} />
                <InfoPill label="Hệ thống sẽ tính" value={`${editingJoinPreview.joinSessionNumber}/${editingCourse?.courseTotalSessions ?? 0}`} />
                <InfoPill label="Còn từ ngày bắt đầu" value={`${editingJoinPreview.sessionsFromJoin} buổi`} />
              </div>
              {editingJoinPreview.warning ? (
                <p className="md:col-span-2 rounded-2xl border border-brand-red/10 bg-white/45 px-3 py-2 text-xs font-semibold text-stone-500">{editingJoinPreview.warning}</p>
              ) : null}
              <label className="flex items-center gap-2 rounded-2xl border border-brand-red/10 px-3 py-3 text-sm font-semibold text-stone-600 md:col-span-2">
                <input type="checkbox" checked={editingEnrollment.isActive} onChange={(event) => setEditingEnrollment({ ...editingEnrollment, isActive: event.target.checked })} />
                Khóa đang hoạt động
              </label>
            </div>
        </DialogFormShell>
      ) : null}
    </main>
  )
}

function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onCancel,
  onConfirm
}: {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  onCancel: () => void
  onConfirm: () => void
}) {
  if (!open) return null

  return (
    <DialogShell title={title} onClose={onCancel} closeLabel="Đóng xác nhận" size="sm" zIndexClassName="z-[60]">
      <p className="text-sm leading-6 text-stone-600">{description}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="glass-button-secondary px-4 py-3 text-sm font-semibold">Hủy</button>
        <button type="button" onClick={onConfirm} className="glass-button-primary px-4 py-3 text-sm font-semibold">{confirmLabel}</button>
      </div>
    </DialogShell>
  )
}

function LearningDetailDialog({ target, onClose }: { target: LearningDetailTarget | null; onClose: () => void }) {
  if (!target) return null

  if (target.kind === "course") {
    const course = target.course
    const coursePrice = Number(course.coursePrice)
    const unitPrice = course.courseTotalSessions ? coursePrice / course.courseTotalSessions : 0

    return (
      <DialogShell
        eyebrow="Chi tiết khóa đã đăng ký"
        title={course.courseName}
        onClose={onClose}
        closeLabel="Đóng chi tiết khóa đã đăng ký"
        size="lg"
        bodyClassName="p-0"
      >
          <div className="content-border grid gap-3 p-5 md:grid-cols-3">
            <LearningMetric label="Trạng thái" value={course.isActive ? "Đang học" : "Đã hủy"} />
            <LearningMetric label="Môn học" value={course.courseSubject} />
            <LearningMetric label="Lớp" value={course.className ?? "Chưa xếp lớp"} />
            <LearningMetric label="Giá nguyên khóa" value={formatCurrency(coursePrice)} />
            <LearningMetric label="Tổng buổi khóa" value={`${course.courseTotalSessions} buổi`} />
            <LearningMetric label="Đơn giá/buổi" value={formatCurrency(unitPrice)} />
            <LearningMetric label="Quỹ buổi hiện có" value={`${course.sessionsBought} buổi`} />
            <LearningMetric label="Đã học" value={`${course.sessionsUsed} buổi`} />
            <LearningMetric label="Còn lại" value={`${course.sessionsRemaining} buổi`} />
            <LearningMetric label="Bé bắt đầu từ buổi" value={`${course.joinSessionNumber ?? 1}`} />
            <LearningMetric label="Học thử miễn phí" value={`${course.freeTrialSessions} buổi`} />
            <LearningMetric label="Đã học trước khi đóng" value={`${course.paidSessionsBeforeReceipt} buổi`} />
          </div>
          <div className="grid gap-3 p-5 md:grid-cols-2">
            <div className="rounded-2xl border border-brand-red/10 bg-white/45 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Tiến độ lớp</p>
              <p className="mt-2 text-lg font-semibold text-brand-ink">{course.classProgress?.label ?? "Chưa có lịch lớp"}</p>
              <p className="mt-1 text-sm text-stone-500">
                {course.classProgress?.nextSessionDate ? `Buổi tiếp theo ${formatDate(course.classProgress.nextSessionDate)}` : "Chưa có buổi tiếp theo."}
              </p>
            </div>
            <div className="rounded-2xl border border-brand-red/10 bg-white/45 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Mốc ghi danh</p>
              <p className="mt-2 text-sm font-semibold text-brand-ink">Bắt đầu: {course.startDate ? formatDate(course.startDate) : "Chưa ghi nhận"}</p>
              <p className="mt-1 text-sm text-stone-500">Kết thúc: {course.endDate ? formatDate(course.endDate) : "Chưa ghi nhận"}</p>
            </div>
          </div>
      </DialogShell>
    )
  }

  const klass = target.klass

  return (
    <DialogShell
      eyebrow="Chi tiết lớp học"
      title={klass.name}
      onClose={onClose}
      closeLabel="Đóng chi tiết lớp học"
      size="lg"
      bodyClassName="p-0"
    >
        <div className="content-border grid gap-3 p-5 md:grid-cols-3">
          <LearningMetric label="Khóa học" value={klass.courseName} />
          <LearningMetric label="Giáo viên" value={klass.teacherName} />
          <LearningMetric label="Lịch học" value={`${formatWeekday(klass.weekday)}, ${klass.startTime}-${klass.endTime}`} />
          <LearningMetric label="Tiến độ" value={klass.progress?.label ?? "Chưa có lịch"} />
          <LearningMetric label="Buổi hiện tại" value={klass.progress ? `${klass.progress.currentSessionNumber}/${klass.progress.totalSessions}` : "Chưa có"} />
          <LearningMetric label="Buổi tiếp theo" value={klass.progress?.nextSessionDate ? formatDate(klass.progress.nextSessionDate) : "Chưa có"} />
        </div>
    </DialogShell>
  )
}

function LearningMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-brand-red/10 bg-white/45 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-brand-ink">{value}</p>
    </div>
  )
}

function SectionHeader({ title, description, icon }: { title: string; description?: string; icon?: React.ReactNode }) {
  return (
    <div className="p-5">
      <h2 className="flex items-center gap-2 font-semibold text-brand-ink">
        {icon}
        {title}
      </h2>
      {description ? <p className="mt-1 text-sm text-stone-500">{description}</p> : null}
    </div>
  )
}

function FormFooter({ loading, label, loadingLabel, disabled = false }: { loading: boolean; label: string; loadingLabel: string; disabled?: boolean }) {
  return (
    <div className="flex justify-end p-5">
      <button type="submit" disabled={loading || disabled} className="glass-button-primary inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60">
        <Plus className="h-4 w-4" />
        {loading ? loadingLabel : label}
      </button>
    </div>
  )
}

function InfoCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="neu-card rounded-3xl p-5">
      <h2 className="font-semibold text-brand-ink">{title}</h2>
      <div className="mt-4 space-y-2">
        {items.map((item) => <p key={item} className="rounded-2xl border border-brand-red/10 px-3 py-2 text-sm text-stone-600">{item}</p>)}
      </div>
    </div>
  )
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-brand-red/10 bg-white/45 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-brand-ink">{value}</p>
    </div>
  )
}

function ListCard({ title, count, children }: { title: string; count?: string; children: React.ReactNode }) {
  return (
    <div className="neu-card rounded-3xl">
      <div className="flex items-center justify-between gap-3 p-5">
        <h2 className="font-semibold text-brand-ink">{title}</h2>
        {count ? <span className="rounded-2xl border border-brand-red/10 px-3 py-2 text-xs font-semibold text-brand-red">{count}</span> : null}
      </div>
      <div className="content-border max-h-[58vh] space-y-3 overflow-auto p-5">{children}</div>
    </div>
  )
}

function StudentWalletCard({ summary }: { summary: StudentWalletSummary | null }) {
  const entries = summary?.entries ?? []
  const balance = Number(summary?.balance ?? 0)

  return (
    <section className="neu-card rounded-3xl">
      <div className="flex flex-col gap-2 p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-semibold text-brand-ink">Ví credit học viên</h2>
          <p className="mt-1 text-sm text-stone-500">Credit từ học bù và các lần đã áp dụng vào phiếu thu.</p>
        </div>
        <span className="rounded-2xl border border-brand-red/10 px-3 py-2 text-xs font-semibold text-brand-red">{formatCurrency(balance)}</span>
      </div>
      <div className="content-border max-h-[34vh] space-y-3 overflow-auto p-5">
        {entries.length ? entries.map((entry) => (
          <article key={entry.id} className="neu-list-item rounded-2xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-brand-red/15 px-2 py-1 text-xs font-semibold text-brand-red">{studentWalletEntryTypeLabels[entry.type]}</span>
                  <span className="rounded-full border border-brand-red/10 px-2 py-1 text-xs font-semibold text-stone-500">{formatDate(entry.createdAt)}</span>
                  {entry.receiptCode ? <span className="rounded-full border border-brand-red/10 px-2 py-1 text-xs font-semibold text-stone-500">{entry.receiptCode}</span> : null}
                </div>
                <p className="mt-2 line-clamp-2 text-xs text-stone-500">{entry.note ?? "Không có ghi chú ví."}</p>
              </div>
              <p className="shrink-0 text-sm font-semibold text-brand-red">{formatCurrency(Number(entry.amount))}</p>
            </div>
          </article>
        )) : <EmptyState text={summary ? "Chưa có giao dịch ví." : "Không có dữ liệu ví hoặc tài khoản không có quyền xem ví."} />}
      </div>
    </section>
  )
}

function EnrollmentTransferHistory({ transfers }: { transfers: StudentDetail["enrollmentTransfers"] }) {
  return (
    <section className="neu-card rounded-3xl">
      <div className="flex flex-col gap-2 p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-semibold text-brand-ink">Lịch sử chuyển lớp/khóa</h2>
          <p className="mt-1 text-sm text-stone-500">Audit phí còn dư và lớp/khóa mới sau mỗi lần chuyển.</p>
        </div>
        <span className="rounded-2xl border border-brand-red/10 px-3 py-2 text-xs font-semibold text-brand-red">{transfers.length} lần</span>
      </div>
      <div className="content-border max-h-[34vh] space-y-3 overflow-auto p-5">
        {transfers.length ? transfers.map((transfer) => (
          <article key={transfer.id} className="neu-list-item rounded-2xl p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-brand-ink">
                  {transfer.fromCourseName}
                  {transfer.toCourseName ? ` → ${transfer.toCourseName}` : ""}
                </p>
                <p className="mt-1 text-xs text-stone-500">
                  {transfer.fromClassName ? `Lớp cũ ${transfer.fromClassName}` : "Không có lớp cũ"}
                  {transfer.toClassName ? ` · lớp mới ${transfer.toClassName}` : ""}
                </p>
                <p className="mt-2 line-clamp-2 text-xs text-stone-500">{transfer.reason}</p>
              </div>
              <div className="shrink-0 text-left md:text-right">
                <p className="text-sm font-semibold text-brand-red">{formatCurrency(Number(transfer.creditAmount))}</p>
                <p className="mt-1 text-xs text-stone-500">{transfer.remainingSessions} buổi còn · {formatDate(transfer.createdAt)}</p>
                <p className="mt-1 text-xs text-stone-500">Tạo bởi {transfer.createdByName}</p>
              </div>
            </div>
          </article>
        )) : <EmptyState text="Chưa có lịch sử chuyển lớp/khóa." />}
      </div>
    </section>
  )
}

function MakeupEntitlementCard({ entitlements }: { entitlements: MakeupEntitlementItem[] }) {
  return (
    <section className="neu-card rounded-3xl">
      <div className="flex flex-col gap-2 p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-semibold text-brand-ink">Học bù, credit và refund</h2>
          <p className="mt-1 text-sm text-stone-500">Theo dõi mỗi quyền học bù và cách quyền đó được xử lý.</p>
        </div>
        <span className="rounded-2xl border border-brand-red/10 px-3 py-2 text-xs font-semibold text-brand-red">{entitlements.length} quyền</span>
      </div>
      <div className="content-border max-h-[34vh] space-y-3 overflow-auto p-5">
        {entitlements.length ? entitlements.map((entitlement) => (
          <article key={entitlement.id} className="neu-list-item rounded-2xl p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-brand-red/15 px-2 py-1 text-xs font-semibold text-brand-red">{makeupEntitlementStatusLabels[entitlement.status]}</span>
                  <span className="rounded-full border border-brand-red/10 px-2 py-1 text-xs font-semibold text-stone-500">{entitlement.month}</span>
                  <span className="rounded-full border border-brand-red/10 px-2 py-1 text-xs font-semibold text-stone-500">{entitlement.isEligible ? "Đủ điều kiện" : "Không đủ điều kiện"}</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-brand-ink">{entitlement.courseName}</p>
                <p className="mt-1 line-clamp-2 text-xs text-stone-500">
                  {entitlement.className ? `${entitlement.className} · ` : ""}
                  {entitlement.sessionDate ? `Nghỉ ngày ${formatDate(entitlement.sessionDate)}` : entitlement.eligibilityReason ?? "Chưa có ngày nghỉ gốc."}
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold text-stone-500">
                  {entitlement.scheduledFor ? <span className="rounded-full border border-brand-red/10 px-2 py-1">Học bù {formatDate(entitlement.scheduledFor)}</span> : null}
                  {entitlement.resolvedAmount ? <span className="rounded-full border border-brand-red/10 px-2 py-1">Số tiền {formatCurrency(Number(entitlement.resolvedAmount))}</span> : null}
                  {entitlement.refundExpenseCode ? <span className="rounded-full border border-brand-red/10 px-2 py-1">Refund {entitlement.refundExpenseCode}</span> : null}
                </div>
              </div>
              <p className="shrink-0 text-xs text-stone-500">{formatDate(entitlement.updatedAt)}</p>
            </div>
          </article>
        )) : <EmptyState text="Chưa có quyền học bù, credit hoặc refund." />}
      </div>
    </section>
  )
}

function ReceiptHistoryCard({ receipts }: { receipts: ReceiptListItem[] }) {
  return (
    <section className="neu-card rounded-3xl">
      <div className="flex flex-col gap-2 p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-semibold text-brand-ink">Lịch sử phiếu thu</h2>
          <p className="mt-1 text-sm text-stone-500">Toàn bộ phiếu thu của học viên, gồm phiếu theo khóa, theo tháng và phiếu gộp nhiều khóa.</p>
        </div>
        <span className="rounded-2xl border border-brand-red/10 px-3 py-2 text-xs font-semibold text-brand-red">{receipts.length} phiếu</span>
      </div>
      <div className="content-border max-h-[42vh] space-y-3 overflow-auto p-5">
        {receipts.length ? receipts.map((receipt) => (
          <article key={receipt.id} className="neu-list-item rounded-2xl p-4 transition hover:shadow-md">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-brand-red/15 px-2 py-1 text-xs font-semibold text-brand-red">{receipt.code}</span>
                  <span className="rounded-full border border-brand-red/10 px-2 py-1 text-xs font-semibold text-stone-500">{paymentMethodLabels[receipt.method]}</span>
                  <span className="rounded-full border border-brand-red/10 px-2 py-1 text-xs font-semibold text-stone-500">{formatDate(receipt.createdAt)}</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-brand-ink">{receipt.courseName}</p>
                <p className="mt-1 line-clamp-2 text-xs text-stone-500">{receipt.note ?? "Không có ghi chú phiếu thu."}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold text-stone-500">
	                  {receipt.lines.length ? receipt.lines.map((line) => (
	                    <span key={line.id} className="rounded-full border border-brand-red/10 px-2 py-1">
	                      {line.courseName}: {line.billableSessions} buổi{line.billingLabel ? ` · ${line.billingLabel}` : ""} · {formatCurrency(Number(line.amount))}
	                    </span>
                  )) : (
                    <span className="rounded-full border border-brand-red/10 px-2 py-1">{receipt.billableSessions} buổi tính phí</span>
                  )}
                  {receipt.extraLines.map((line) => (
                    <span key={line.id} className="rounded-full border border-brand-red/10 px-2 py-1">
                      {receiptExtraLineTypeLabels[line.type]}: {line.description} · {formatCurrency(Number(line.amount))}
                    </span>
                  ))}
                  {Number(receipt.walletCreditAmount) > 0 ? (
                    <span className="rounded-full border border-brand-red/10 px-2 py-1">
                      Dùng credit {formatCurrency(Number(receipt.walletCreditAmount))}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 flex-col gap-2 lg:items-end">
                <p className="text-base font-semibold text-brand-red">{formatCurrency(Number(receipt.amount))}</p>
                {Number(receipt.walletCreditAmount) > 0 ? (
                  <p className="text-xs font-semibold text-stone-500">Trước credit {formatCurrency(Number(receipt.amountBeforeWalletCredit))}</p>
                ) : null}
                <Link href={`/receipts/${receipt.id}/print`} target="_blank" className="glass-button-secondary inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold">
                  <Printer className="h-3.5 w-3.5" />
                  In phiếu
                </Link>
              </div>
            </div>
          </article>
        )) : <EmptyState text="Chưa có phiếu thu nào cho học viên này." />}
      </div>
    </section>
  )
}

function EmptyState({ text }: { text: string }) {
  return <p className="rounded-2xl border border-brand-red/10 p-4 text-sm text-stone-500">{text}</p>
}

function DetailInput({
  label,
  value,
  onChange,
  type = "text",
  min,
  hint,
  required = false
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  min?: number
  hint?: string
  required?: boolean
}) {
  return (
    <label className="group relative block text-sm font-semibold text-stone-700">
      {label}
      <input
        className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none placeholder:text-stone-400"
        type={type}
        min={min}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
      />
      {hint ? <FieldHint>{hint}</FieldHint> : null}
    </label>
  )
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return (
    <span className="pointer-events-none absolute left-0 top-full z-20 mt-2 hidden max-w-xs rounded-2xl border border-brand-red/10 bg-white/95 px-3 py-2 text-xs font-medium leading-5 text-stone-600 shadow-[0_14px_35px_rgba(165,36,39,0.14)] group-focus-within:block group-hover:block">
      {children}
    </span>
  )
}
