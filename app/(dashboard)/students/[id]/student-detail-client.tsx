"use client"

import { ArrowLeft, BarChart3, BookOpenCheck, CalendarClock, CheckCircle2, ClipboardCheck, CreditCard, ImagePlus, KeyRound, Pencil, Phone, Plus, Printer, RotateCcw, Save, ShieldCheck, UserRound } from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import type { ApiResponse } from "@/lib/api-response"
import { DialogFormShell, DialogShell } from "@/components/shared/dialog-shell"
import { assessmentStatusLabels, subjectLabels } from "@/lib/contracts/assessment"
import { attendanceStatusLabels } from "@/lib/contracts/classes"
import { contactResultLabels, type ContactResultKey, taskStatusLabels } from "@/lib/contracts/crm"
import type { ClassListItem, CourseListItem } from "@/lib/contracts/courses"
import type { EnrollmentDeleteResult } from "@/lib/contracts/enrollments"
import { paymentMethodLabels, type PaymentMethodKey, type ReceiptListItem } from "@/lib/contracts/finance"
import { studentStatusLabels, type ParentAccountInfo, type StudentContactLogItem, type StudentDetail, type StudentStatusKey, type StudentTaskItem } from "@/lib/contracts/students"

type DetailTab = "overview" | "crm" | "learning" | "finance" | "journal" | "parent-account"
type ParentAccountAction = "activate" | "reset_default_password"
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
type EnrollmentEditDraft = {
  enrollmentId: string
  classId: string
  startDate: string
  joinSessionNumber: string
  freeTrialSessions: string
  paidSessionsBeforeReceipt: string
  sessionsBought: string
  sessionsUsed: string
  isActive: boolean
}
type LearningDetailTarget =
  | { kind: "course"; course: StudentDetail["courses"][number] }
  | { kind: "class"; klass: StudentDetail["classes"][number] }

const contactResults = Object.entries(contactResultLabels) as Array<[ContactResultKey, string]>
const paymentMethods = Object.entries(paymentMethodLabels) as Array<[PaymentMethodKey, string]>
const studentStatusOptions = Object.entries(studentStatusLabels) as Array<[StudentStatusKey, string]>
const detailTabs: Array<{ key: DetailTab; label: string }> = [
  { key: "overview", label: "Tổng quan" },
  { key: "crm", label: "CRM" },
  { key: "learning", label: "Học tập" },
  { key: "finance", label: "Tài chính" },
  { key: "journal", label: "Ảnh & nhật ký" },
  { key: "parent-account", label: "Tài khoản PH" }
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
    paidSessionsBeforeReceipt: String(course.paidSessionsBeforeReceipt),
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
  const [enrollmentJoinSessionNumber, setEnrollmentJoinSessionNumber] = useState("1")
  const [enrollmentFreeTrialSessions, setEnrollmentFreeTrialSessions] = useState("0")
  const [enrollmentPaidSessionsBeforeReceipt, setEnrollmentPaidSessionsBeforeReceipt] = useState("0")
  const [enrollmentStartDate, setEnrollmentStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [receiptAmount, setReceiptAmount] = useState("")
  const [receiptLines, setReceiptLines] = useState<ReceiptDraftLine[]>([])
  const [receiptMethod, setReceiptMethod] = useState<PaymentMethodKey>("BANK_TRANSFER")
  const [receiptNote, setReceiptNote] = useState("")
  const [isReceiptAmountOverride, setIsReceiptAmountOverride] = useState(false)
  const [pendingBillableEnrollmentId, setPendingBillableEnrollmentId] = useState<string | null>(null)
  const [isConfirmingReceiptAmount, setIsConfirmingReceiptAmount] = useState(false)
  const [editingEnrollment, setEditingEnrollment] = useState<EnrollmentEditDraft | null>(null)
  const [selectedLearningDetail, setSelectedLearningDetail] = useState<LearningDetailTarget | null>(null)
  const [isConfirmingEnrollmentDelete, setIsConfirmingEnrollmentDelete] = useState(false)
  const [studentReceipts, setStudentReceipts] = useState<ReceiptListItem[]>([])
  const [lastReceipt, setLastReceipt] = useState<ReceiptListItem | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmittingLog, setIsSubmittingLog] = useState(false)
  const [isSubmittingTask, setIsSubmittingTask] = useState(false)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isSubmittingEnrollment, setIsSubmittingEnrollment] = useState(false)
  const [isUpdatingEnrollment, setIsUpdatingEnrollment] = useState(false)
  const [isDeletingEnrollment, setIsDeletingEnrollment] = useState(false)
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
  const selectedEnrollmentCourse = useMemo(
    () => activeCourseOptions.find((course) => course.id === enrollmentCourseId),
    [activeCourseOptions, enrollmentCourseId]
  )
  const selectedEnrollmentPrice = selectedEnrollmentCourse ? Number(selectedEnrollmentCourse.price) : 0
  const selectedEnrollmentUnitPrice = selectedEnrollmentCourse?.totalSessions ? selectedEnrollmentPrice / selectedEnrollmentCourse.totalSessions : 0
  const enrollmentJoinNumber = Math.max(1, toNumber(enrollmentJoinSessionNumber) || 1)
  const enrollmentTotalSessions = selectedEnrollmentCourse?.totalSessions ?? 0
  const enrollmentSessionsFromJoin = Math.max(0, enrollmentTotalSessions - enrollmentJoinNumber + 1)
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
    const billableSessions = line.isBillableOverride ? toNonNegativeNumber(line.billableSessions) : (totalSessions ? defaultBillableSessions : fallbackBillableSessions)
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
      grossAmount,
      discount,
      amount,
      remainingAfterReceipt: Math.max(0, nextSessionsBought - nextSessionsUsed)
    }
  }), [receiptLines, student?.courses])
  const payableAmount = receiptLineSummaries.reduce((total, line) => total + line.amount, 0)
  const hasManualReceiptAmount = isReceiptAmountOverride && receiptAmount !== ""
  const actualReceiptAmount = hasManualReceiptAmount ? parseMoneyInput(receiptAmount) : payableAmount
  const receiptAmountSuggestions = moneySuggestions(receiptAmount)
  const latestReceipt = lastReceipt ?? studentReceipts[0]
  const totalReceiptAmount = studentReceipts.reduce((total, receipt) => total + Number(receipt.amount), 0)
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

    if (actualReceiptAmount < 0) errors.push("Phụ huynh cần thanh toán không được âm.")
    if (receiptLines.length && !receiptLineSummaries.some((summary) => summary.billableSessions > 0) && !hasManualReceiptAmount) {
      errors.push("Không có buổi tính phí sau học thử. Hãy kiểm tra lại số buổi học thử hoặc nhập số tiền cần thu nếu đây là ngoại lệ.")
    }

    return errors
  }, [actualReceiptAmount, hasManualReceiptAmount, receiptLineSummaries, receiptLines, student?.courses])

  function syncProfileForm(nextStudent: StudentDetail) {
    setProfileName(nextStudent.name)
    setProfileBirthDate(nextStudent.birthDate?.slice(0, 10) ?? "")
    setProfileStatus(nextStudent.status)
    setProfileParentName(nextStudent.parentName)
    setProfileParentPhone(nextStudent.parentPhone)
    setProfileParentEmail(nextStudent.parentEmail ?? "")
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

  useEffect(() => {
    let isMounted = true

    async function loadInitialData() {
      setIsLoading(true)
      setError(null)

      try {
        const [studentResponse, coursesResponse, classesResponse, receiptsResponse] = await Promise.all([
          fetch(`/api/students/${studentId}`, { cache: "no-store" }),
          fetch("/api/courses"),
          fetch("/api/classes?active=true"),
          fetch(`/api/receipts?studentId=${studentId}`, { cache: "no-store" })
        ])
        const studentPayload = (await studentResponse.json()) as ApiResponse<StudentDetail>
        const coursesPayload = (await coursesResponse.json()) as ApiResponse<CourseListItem[]>
        const classesPayload = (await classesResponse.json()) as ApiResponse<ClassListItem[]>
        const receiptsPayload = (await receiptsResponse.json()) as ApiResponse<ReceiptListItem[]>

        if (!isMounted) return

        if (!studentResponse.ok || !studentPayload.success || !studentPayload.data) {
          setError(studentPayload.error?.message ?? "Không tải được hồ sơ học viên.")
          return
        }

        const nextStudent = studentPayload.data
        setStudent(nextStudent)
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
          joinSessionNumber: enrollmentJoinNumber,
          totalCourseSessionsAtJoin: selectedEnrollmentCourse?.totalSessions,
          freeTrialSessions: toNonNegativeNumber(enrollmentFreeTrialSessions),
          paidSessionsBeforeReceipt: toNonNegativeNumber(enrollmentPaidSessionsBeforeReceipt),
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
      setEnrollmentJoinSessionNumber("1")
      setEnrollmentFreeTrialSessions("0")
      setEnrollmentPaidSessionsBeforeReceipt("0")
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
          joinSessionNumber: Math.max(1, toNonNegativeNumber(editingEnrollment.joinSessionNumber) || 1),
          freeTrialSessions: toNonNegativeNumber(editingEnrollment.freeTrialSessions),
          paidSessionsBeforeReceipt: toNonNegativeNumber(editingEnrollment.paidSessionsBeforeReceipt),
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

  async function submitReceipt(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (receiptValidationErrors.length) {
      setError(receiptValidationErrors[0])
      return
    }

    setIsSubmittingReceipt(true)
    setError(null)

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
            extraDiscountInput: summary.line.extraDiscountInput.trim() || undefined
          })),
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
      setIsReceiptAmountOverride(false)
      setReceiptNote("")
      setLastReceipt(payload.data)
      await loadStudent()
      await loadReceipts()
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
  }

  function updateReceiptLine(enrollmentId: string, patch: Partial<ReceiptDraftLine>) {
    setReceiptLines((current) => current.map((line) => line.enrollmentId === enrollmentId ? { ...line, ...patch } : line))
    setReceiptAmount("")
    setIsReceiptAmountOverride(false)
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
            <InfoCard title="Thông tin phụ huynh" items={[student.parentName, student.parentPhone, student.parentEmail ?? "Chưa có email"]} />
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
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <InfoPill label="Tổng còn lại" value={`${student.sessionsRemaining} buổi`} />
            <InfoPill label="Khóa đang hoạt động" value={`${activeStudentCourses(student).length} khóa`} />
            <InfoPill label="Đã thu tất cả" value={studentReceipts.length ? formatCurrency(totalReceiptAmount) : "Chưa có phiếu"} />
            <InfoPill label="Phiếu thu gần nhất" value={latestReceipt ? `${latestReceipt.code} · ${formatCurrency(Number(latestReceipt.amount))}` : "Chưa có phiếu"} />
          </div>
          <ReceiptHistoryCard receipts={studentReceipts} />
          <div className="grid gap-4 xl:grid-cols-[0.95fr_1.25fr]">
          <form className="neu-card rounded-3xl" onSubmit={submitEnrollment}>
            <SectionHeader icon={<BookOpenCheck className="h-5 w-5 text-brand-red" />} title="1. Ghi danh khóa/lớp" description="Xác định bé vào từ buổi số mấy trước khi thu học phí." />
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
                  {classOptions.map((klass) => <option key={klass.id} value={klass.id}>{klass.name} · {klass.startTime}</option>)}
                </select>
              </label>
              <DetailInput label="Ngày bắt đầu" type="date" value={enrollmentStartDate} onChange={setEnrollmentStartDate} required />
              <DetailInput label="Bé bắt đầu từ buổi số" type="number" min={1} value={enrollmentJoinSessionNumber} onChange={(value) => setEnrollmentJoinSessionNumber(toNonNegativeIntegerInput(value))} required />
              <DetailInput label="Học thử miễn phí dự kiến" type="number" min={0} value={enrollmentFreeTrialSessions} onChange={(value) => setEnrollmentFreeTrialSessions(toNonNegativeIntegerInput(value))} />
              <DetailInput
                label="Buổi đã học chưa thu tiền"
                type="number"
                min={0}
                value={enrollmentPaidSessionsBeforeReceipt}
                onChange={(value) => setEnrollmentPaidSessionsBeforeReceipt(toNonNegativeIntegerInput(value))}
                hint="Số buổi bé đã học có tính phí trước khi phụ huynh đóng tiền. Khi thu, hệ thống trừ ngay số buổi này khỏi quỹ còn lại."
              />
              <DetailInput
                label="Quỹ buổi ban đầu"
                type="number"
                min={0}
                value={enrollmentSessions}
                onChange={(value) => setEnrollmentSessions(toNonNegativeIntegerInput(value))}
                hint="Thường để 0. Chỉ nhập khi chuyển dữ liệu cũ hoặc muốn cấp buổi trước khi tạo phiếu thu."
                required
              />
              <div className="md:col-span-2 grid gap-3 md:grid-cols-4">
                <InfoPill label="Giá nguyên khóa" value={selectedEnrollmentCourse ? formatCurrency(selectedEnrollmentPrice) : "Chưa chọn"} />
                <InfoPill label="Tổng buổi khóa" value={selectedEnrollmentCourse ? `${selectedEnrollmentCourse.totalSessions} buổi` : "Chưa chọn"} />
                <InfoPill label="Đơn giá/buổi" value={selectedEnrollmentCourse ? formatCurrency(selectedEnrollmentUnitPrice) : "Chưa chọn"} />
                <InfoPill label="Còn từ lúc bé vào" value={selectedEnrollmentCourse ? `${enrollmentSessionsFromJoin} buổi` : "Chưa chọn"} />
              </div>
            </div>
            <FormFooter loading={isSubmittingEnrollment} label="Ghi danh" loadingLabel="Đang ghi danh" disabled={!enrollmentCourseId} />
          </form>
          <form className="neu-card rounded-3xl" onSubmit={submitReceipt}>
            <SectionHeader icon={<CreditCard className="h-5 w-5 text-brand-red" />} title="2. Tạo phiếu thu" description="Chọn một hoặc nhiều khóa đã đăng ký, hệ thống tự tính buổi và tổng cần thanh toán." />
            <div className="content-border space-y-4 p-5">
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

              <div className="grid gap-3 md:grid-cols-2">
                <label className="block text-sm font-semibold text-stone-700">
                  Phụ huynh cần thanh toán
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
                      <span className="text-stone-500">Tự tính từ các dòng khóa</span>
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
            <FormFooter loading={isSubmittingReceipt} label="Tạo phiếu thu" loadingLabel="Đang thu" disabled={!receiptLineSummaries.length || actualReceiptAmount < 0 || receiptValidationErrors.length > 0} />
          </form>
          </div>
        </section>
      ) : null}

      {activeTab === "journal" ? (
        <section className="neu-card rounded-3xl">
          <div className="flex flex-col gap-2 p-5 md:flex-row md:items-center md:justify-between">
            <h2 className="font-semibold text-brand-ink">Album ảnh học viên</h2>
            <span className="rounded-2xl border border-brand-red/10 px-3 py-2 text-xs font-semibold text-brand-red">{student.photos.length} ảnh</span>
          </div>
          <div className="content-border grid gap-3 p-5 md:grid-cols-3">
            {student.photos.length ? student.photos.map((photo) => (
              <article key={photo.id} className="neu-list-item overflow-hidden rounded-2xl">
                <div className="aspect-video bg-cover bg-center" style={{ backgroundImage: `url(${photo.url})` }} />
                <div className="content-border p-3">
                  <p className="inline-flex items-center gap-1 text-xs font-semibold text-brand-red"><ImagePlus className="h-3.5 w-3.5" />{formatDate(photo.takenAt)}</p>
                </div>
              </article>
            )) : <p className="rounded-2xl border border-brand-red/10 p-4 text-sm text-stone-500 md:col-span-3">Chưa có ảnh học viên.</p>}
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
              <InfoPill label="Mật khẩu mặc định V1" value="SĐT phụ huynh" />
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" disabled={isUpdatingParentAccount || student.parentAccount.canLogin} onClick={() => void updateParentAccount("activate")} className="glass-button-primary inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60">
                <ShieldCheck className="h-4 w-4" />
                Kích hoạt tài khoản
              </button>
              <button type="button" disabled={isUpdatingParentAccount} onClick={() => void updateParentAccount("reset_default_password")} className="glass-button-secondary inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold">
                <RotateCcw className="h-4 w-4" />
                Đặt lại mật khẩu = SĐT
              </button>
            </div>
          </div>
          <div className="neu-card rounded-3xl p-5">
            <h2 className="font-semibold text-brand-ink">Hướng dẫn gửi phụ huynh</h2>
            <div className="mt-4 rounded-2xl border border-brand-red/10 bg-white/45 p-4 text-sm text-stone-700">
              <p>Link: http://localhost:3000/login</p>
              <p className="mt-2">Số điện thoại: {student.parentAccount.phone}</p>
              <p>Mật khẩu mặc định: số điện thoại phụ huynh</p>
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
                  {editingClassOptions.map((klass) => <option key={klass.id} value={klass.id}>{klass.name} · {klass.startTime}</option>)}
                </select>
              </label>
              <DetailInput label="Ngày bắt đầu" type="date" value={editingEnrollment.startDate} onChange={(value) => setEditingEnrollment({ ...editingEnrollment, startDate: value })} />
              <DetailInput label="Bé bắt đầu từ buổi số" type="number" min={1} value={editingEnrollment.joinSessionNumber} onChange={(value) => setEditingEnrollment({ ...editingEnrollment, joinSessionNumber: toNonNegativeIntegerInput(value) })} />
              <DetailInput label="Học thử miễn phí dự kiến" type="number" min={0} value={editingEnrollment.freeTrialSessions} onChange={(value) => setEditingEnrollment({ ...editingEnrollment, freeTrialSessions: toNonNegativeIntegerInput(value) })} />
              <DetailInput
                label="Buổi đã học chưa thu tiền"
                type="number"
                min={0}
                value={editingEnrollment.paidSessionsBeforeReceipt}
                onChange={(value) => setEditingEnrollment({ ...editingEnrollment, paidSessionsBeforeReceipt: toNonNegativeIntegerInput(value) })}
                hint="Số buổi bé đã học có tính phí trước khi phụ huynh đóng tiền."
              />
              <DetailInput
                label="Quỹ buổi hiện có"
                type="number"
                min={0}
                value={editingEnrollment.sessionsBought}
                onChange={(value) => setEditingEnrollment({ ...editingEnrollment, sessionsBought: toNonNegativeIntegerInput(value) })}
                hint="Tổng số buổi đang được cấp cho khóa này, gồm dữ liệu cũ và các phiếu thu đã tạo."
              />
              <DetailInput label="Số buổi đã học" type="number" min={0} value={editingEnrollment.sessionsUsed} onChange={(value) => setEditingEnrollment({ ...editingEnrollment, sessionsUsed: toNonNegativeIntegerInput(value) })} />
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
                      {line.courseName}: {line.billableSessions} buổi · {formatCurrency(Number(line.amount))}
                    </span>
                  )) : (
                    <span className="rounded-full border border-brand-red/10 px-2 py-1">{receipt.billableSessions} buổi tính phí</span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 flex-col gap-2 lg:items-end">
                <p className="text-base font-semibold text-brand-red">{formatCurrency(Number(receipt.amount))}</p>
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
