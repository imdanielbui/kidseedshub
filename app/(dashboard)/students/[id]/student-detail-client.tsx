"use client"

import { ArrowLeft, Repeat2, Save, UserRound } from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import type { ApiResponse } from "@/lib/api-response"
import { DialogFormShell } from "@/components/shared/dialog-shell"
import type { ClassPhotoListItem } from "@/lib/contracts/classes"
import type { ContactResultKey } from "@/lib/contracts/crm"
import type { ClassListItem, CourseListItem } from "@/lib/contracts/courses"
import type { EnrollmentTransferResult } from "@/lib/contracts/enrollment-transfers"
import type { EnrollmentDeleteResult } from "@/lib/contracts/enrollments"
import type { PaymentMethodKey, ReceiptListItem } from "@/lib/contracts/finance"
import type { MakeupEntitlementItem } from "@/lib/contracts/makeup-entitlements"
import { studentStatusLabels, type ParentAccountInfo, type StudentContactLogItem, type StudentDetail, type StudentStatusKey, type StudentTaskItem } from "@/lib/contracts/students"
import type { StudentWalletSummary } from "@/lib/contracts/student-wallet"
import {
  activeStudentCourses,
  calculateClassJoinPreview,
  countBilledSessionsForMonth,
  countCourseSessionsInBillingMonth,
  detailTabs,
  getBillingMonthChoicesForYear,
  getBillingMonthInRange,
  getBillingPeriodForMonth,
  getBillingYearOptions,
  getCourseBillingMonthOptions,
  getCurrentMonth,
  getYearPart,
  toReceiptDraftLine,
  type DetailTab,
  type EnrollmentEditDraft,
  type EnrollmentTransferDraft,
  type LearningDetailTarget,
  type ParentAccountAction,
  type PhotoReviewFilter,
  type ReceiptBillingMode,
  type ReceiptDraftLine,
  type ReceiptExtraDraftLine
} from "./student-detail-utils"
import {
  DetailInput,
  InfoPill
} from "./student-detail-presentational"
import { ConfirmDialog, LearningDetailDialog, ReceiptPaymentConfirmDialog } from "./student-detail-dialogs"
import {
  formatMoneyInput,
  moneySuggestions,
  parseDiscountInputs,
  parseMoneyInput
} from "./student-detail-money"
import { StudentFinanceTab } from "./student-detail-finance-tab"
import { StudentJournalTab } from "./student-detail-journal-tab"
import { ParentAccountTab, StudentCrmTab, StudentLearningTab, StudentOverviewTab } from "./student-detail-tabs"

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
  const receiptSelectedCourses = useMemo(
    () => receiptLines
      .map((line) => student?.courses.find((course) => course.enrollmentId === line.enrollmentId))
      .filter((course): course is StudentDetail["courses"][number] => Boolean(course)),
    [receiptLines, student?.courses]
  )
  const receiptBillingMonthOptions = useMemo(
    () => getCourseBillingMonthOptions(receiptSelectedCourses, classes),
    [classes, receiptSelectedCourses]
  )
  const activeReceiptBillingMonth = useMemo(
    () => getBillingMonthInRange(receiptBillingMonth, receiptBillingMonthOptions),
    [receiptBillingMonth, receiptBillingMonthOptions]
  )
  const activeReceiptBillingYear = useMemo(() => getYearPart(activeReceiptBillingMonth), [activeReceiptBillingMonth])
  const receiptBillingYearOptions = useMemo(
    () => getBillingYearOptions(receiptBillingMonthOptions, activeReceiptBillingMonth),
    [activeReceiptBillingMonth, receiptBillingMonthOptions]
  )
  const receiptBillingMonthChoices = useMemo(
    () => getBillingMonthChoicesForYear(receiptBillingMonthOptions, activeReceiptBillingYear),
    [activeReceiptBillingYear, receiptBillingMonthOptions]
  )
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
	    const monthlySessions = isReceiptMonthlyBilling ? countCourseSessionsInBillingMonth(course, classes, activeReceiptBillingMonth) : undefined
	    const billedThisMonth = isReceiptMonthlyBilling && course ? countBilledSessionsForMonth(studentReceipts, course.enrollmentId, activeReceiptBillingMonth) : 0
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
	  }), [activeReceiptBillingMonth, classes, isReceiptMonthlyBilling, receiptLines, student?.courses, studentReceipts])
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
	  const receiptValidationErrors = useMemo(() => {
    const errors: string[] = []

    if (isReceiptMonthlyBilling && receiptLines.length && !receiptBillingMonthOptions.length) {
      errors.push("Các khóa đã chọn chưa có khoảng tháng hợp lệ để thu theo tháng.")
    }

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
  }, [actualReceiptAmount, hasManualReceiptAmount, isReceiptMonthlyBilling, receiptBillingMonthOptions.length, receiptExtraLineSummaries, receiptLineSummaries, receiptLines, student?.courses, walletBalance, walletCreditAmount])
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
          fetch("/api/classes?active=true&summary=true"),
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
	    const billingPeriod = isReceiptMonthlyBilling ? getBillingPeriodForMonth(activeReceiptBillingMonth) : null

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
        <StudentOverviewTab
          student={student}
          profileAddress={profileAddress}
          profileBirthDate={profileBirthDate}
          profileHealthNote={profileHealthNote}
          profileLeadNote={profileLeadNote}
          profileLeadSource={profileLeadSource}
          profileName={profileName}
          profileParentEmail={profileParentEmail}
          profileParentName={profileParentName}
          profileParentPhone={profileParentPhone}
          profileStatus={profileStatus}
          isSavingProfile={isSavingProfile}
          onSubmit={submitProfile}
          setProfileAddress={setProfileAddress}
          setProfileBirthDate={setProfileBirthDate}
          setProfileHealthNote={setProfileHealthNote}
          setProfileLeadNote={setProfileLeadNote}
          setProfileLeadSource={setProfileLeadSource}
          setProfileName={setProfileName}
          setProfileParentEmail={setProfileParentEmail}
          setProfileParentName={setProfileParentName}
          setProfileParentPhone={setProfileParentPhone}
          setProfileStatus={setProfileStatus}
        />
      ) : null}

      {activeTab === "crm" ? (
        <StudentCrmTab
          student={student}
          content={content}
          isSubmittingLog={isSubmittingLog}
          isSubmittingTask={isSubmittingTask}
          result={result}
          savingTaskId={savingTaskId}
          taskDueDate={taskDueDate}
          taskNote={taskNote}
          taskTitle={taskTitle}
          formatDate={formatDate}
          markTaskDone={(taskId) => void markTaskDone(taskId)}
          setContent={setContent}
          setResult={setResult}
          setTaskDueDate={setTaskDueDate}
          setTaskNote={setTaskNote}
          setTaskTitle={setTaskTitle}
          submitContactLog={submitContactLog}
          submitTask={submitTask}
        />
      ) : null}

      {activeTab === "learning" ? (
        <StudentLearningTab
          student={student}
          formatDate={formatDate}
          formatWeekday={formatWeekday}
          setSelectedLearningDetail={setSelectedLearningDetail}
        />
      ) : null}

      {activeTab === "finance" ? (
        <StudentFinanceTab
          student={student}
          studentReceipts={studentReceipts}
          studentWallet={studentWallet}
          makeupEntitlements={makeupEntitlements}
          activeCourseOptions={activeCourseOptions}
          classOptions={classOptions}
          enrollmentCourseId={enrollmentCourseId}
          enrollmentClassId={enrollmentClassId}
          enrollmentStartDate={enrollmentStartDate}
          enrollmentFreeTrialSessions={enrollmentFreeTrialSessions}
          enrollmentSessions={enrollmentSessions}
          selectedEnrollmentCourse={selectedEnrollmentCourse}
          selectedEnrollmentPrice={selectedEnrollmentPrice}
          selectedEnrollmentUnitPrice={selectedEnrollmentUnitPrice}
          enrollmentJoinPreview={enrollmentJoinPreview}
          enrollmentSessionsFromJoin={enrollmentSessionsFromJoin}
          isSubmittingEnrollment={isSubmittingEnrollment}
          receiptBillingMode={receiptBillingMode}
          isReceiptMonthlyBilling={isReceiptMonthlyBilling}
          receiptBillingMonthOptions={receiptBillingMonthOptions}
          receiptBillingMonthChoices={receiptBillingMonthChoices}
          receiptBillingYearOptions={receiptBillingYearOptions}
          activeReceiptBillingMonth={activeReceiptBillingMonth}
          activeReceiptBillingYear={activeReceiptBillingYear}
          receiptLines={receiptLines}
          receiptLineSummaries={receiptLineSummaries}
          receiptExtraLineSummaries={receiptExtraLineSummaries}
          receiptMethod={receiptMethod}
          receiptNote={receiptNote}
          receiptAmount={receiptAmount}
          receiptAmountSuggestions={receiptAmountSuggestions}
          receiptValidationErrors={receiptValidationErrors}
          isReceiptAmountOverride={isReceiptAmountOverride}
          isWalletCreditManual={isWalletCreditManual}
          walletCreditInput={walletCreditInput}
          walletBalance={walletBalance}
          suggestedWalletCreditAmount={suggestedWalletCreditAmount}
          walletCreditAmount={walletCreditAmount}
          actualReceiptAmount={actualReceiptAmount}
          actualReceiptPaymentAmount={actualReceiptPaymentAmount}
          payableAmount={payableAmount}
          coursePayableAmount={coursePayableAmount}
          extraPayableAmount={extraPayableAmount}
          latestReceipt={latestReceipt}
          lastReceipt={lastReceipt}
          totalReceiptAmount={totalReceiptAmount}
          isSubmittingReceipt={isSubmittingReceipt}
          formatDate={formatDate}
          formatCurrency={formatCurrency}
          toNonNegativeIntegerInput={toNonNegativeIntegerInput}
          setEnrollmentCourseId={setEnrollmentCourseId}
          setEnrollmentClassId={setEnrollmentClassId}
          setEnrollmentStartDate={setEnrollmentStartDate}
          setEnrollmentFreeTrialSessions={setEnrollmentFreeTrialSessions}
          setEnrollmentSessions={setEnrollmentSessions}
          setReceiptBillingMode={setReceiptBillingMode}
          setReceiptAmount={setReceiptAmount}
          setIsReceiptAmountOverride={setIsReceiptAmountOverride}
          setIsWalletCreditManual={setIsWalletCreditManual}
          setReceiptBillingMonth={setReceiptBillingMonth}
          setPendingBillableEnrollmentId={setPendingBillableEnrollmentId}
          setIsConfirmingReceiptAmount={setIsConfirmingReceiptAmount}
          setWalletCreditInput={setWalletCreditInput}
          setReceiptMethod={setReceiptMethod}
          setReceiptNote={setReceiptNote}
          setEditingEnrollment={setEditingEnrollment}
          submitEnrollment={submitEnrollment}
          submitReceipt={submitReceipt}
          toggleReceiptLine={toggleReceiptLine}
          openTransferDialog={openTransferDialog}
          updateReceiptLine={updateReceiptLine}
          addReceiptExtraLine={addReceiptExtraLine}
          updateReceiptExtraLine={updateReceiptExtraLine}
          removeReceiptExtraLine={removeReceiptExtraLine}
        />
      ) : null}

      {activeTab === "journal" ? (
        <StudentJournalTab
          student={student}
          filteredPhotos={filteredPhotos}
          photoCaptionDrafts={photoCaptionDrafts}
          photoCourseOptions={photoCourseOptions}
          photoCourseFilter={photoCourseFilter}
          photoDateFrom={photoDateFrom}
          photoDateTo={photoDateTo}
          photoReviewFilter={photoReviewFilter}
          photoSavingId={photoSavingId}
          formatDate={formatDate}
          onCaptionChange={(photoId, value) => setPhotoCaptionDrafts((current) => ({ ...current, [photoId]: value }))}
          onCourseFilterChange={setPhotoCourseFilter}
          onDateFromChange={setPhotoDateFrom}
          onDateToChange={setPhotoDateTo}
          onDeletePhoto={(photoId) => void deleteStudentPhoto(photoId)}
          onPatchPhoto={(photoId, body) => void patchStudentPhoto(photoId, body)}
          onResetFilters={() => {
            setPhotoReviewFilter("ALL")
            setPhotoCourseFilter("ALL")
            setPhotoDateFrom("")
            setPhotoDateTo("")
          }}
          onReviewFilterChange={setPhotoReviewFilter}
        />
      ) : null}

      {activeTab === "parent-account" ? (
        <ParentAccountTab
          student={student}
          isUpdatingParentAccount={isUpdatingParentAccount}
          temporaryParentPassword={temporaryParentPassword}
          updateParentAccount={(action) => void updateParentAccount(action)}
        />
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

      <ReceiptPaymentConfirmDialog
        activeReceiptBillingMonth={activeReceiptBillingMonth}
        actualReceiptAmount={actualReceiptAmount}
        actualReceiptPaymentAmount={actualReceiptPaymentAmount}
        coursePayableAmount={coursePayableAmount}
        extraPayableAmount={extraPayableAmount}
        formatCurrency={formatCurrency}
        isOpen={isConfirmingPayment}
        isReceiptMonthlyBilling={isReceiptMonthlyBilling}
        isSubmittingReceipt={isSubmittingReceipt}
        onClose={() => setIsConfirmingPayment(false)}
        onConfirm={() => void confirmReceiptPayment()}
        receiptExtraLineSummaries={receiptExtraLineSummaries}
        receiptLineSummaries={receiptLineSummaries}
        receiptMethod={receiptMethod}
        receiptNote={receiptNote}
        receiptValidationErrors={receiptValidationErrors}
        walletBalance={walletBalance}
        walletCreditAmount={walletCreditAmount}
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

      <LearningDetailDialog
        target={selectedLearningDetail}
        onClose={() => setSelectedLearningDetail(null)}
        formatDate={formatDate}
        formatCurrency={formatCurrency}
        formatWeekday={formatWeekday}
      />

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
