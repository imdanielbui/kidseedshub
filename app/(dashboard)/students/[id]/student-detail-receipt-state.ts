import { useMemo } from "react"
import type { ClassListItem } from "@/lib/contracts/courses"
import type { ReceiptListItem } from "@/lib/contracts/finance"
import type { StudentDetail } from "@/lib/contracts/students"
import type { StudentWalletSummary } from "@/lib/contracts/student-wallet"
import {
  countBilledSessionsForMonth,
  countCourseSessionsInBillingMonth,
  getBillingMonthChoicesForYear,
  getBillingMonthInRange,
  getBillingYearOptions,
  getCourseBillingMonthOptions,
  getYearPart,
  type ReceiptDraftLine,
  type ReceiptExtraDraftLine
} from "./student-detail-utils"
import { moneySuggestions, parseDiscountInputs, parseMoneyInput } from "./student-detail-money"

function toNumber(value: string) {
  const parsed = Number(value.replaceAll(",", ""))
  return Number.isFinite(parsed) ? parsed : 0
}

export function toNonNegativeNumber(value: string) {
  return Math.max(0, toNumber(value))
}

export function toNonNegativeIntegerInput(value: string) {
  const digits = value.replace(/[^\d]/g, "")
  return digits || "0"
}

function hasNegativeSign(value: string) {
  return value.trim().startsWith("-")
}

export function useStudentReceiptState({
  activeReceiptMonth,
  classes,
  isReceiptAmountOverride,
  isReceiptMonthlyBilling,
  isWalletCreditManual,
  lastReceipt,
  receiptAmount,
  receiptExtraLines,
  receiptLines,
  student,
  studentReceipts,
  studentWallet,
  walletCreditInput
}: {
  activeReceiptMonth: string
  classes: ClassListItem[]
  isReceiptAmountOverride: boolean
  isReceiptMonthlyBilling: boolean
  isWalletCreditManual: boolean
  lastReceipt: ReceiptListItem | null
  receiptAmount: string
  receiptExtraLines: ReceiptExtraDraftLine[]
  receiptLines: ReceiptDraftLine[]
  student: StudentDetail | null
  studentReceipts: ReceiptListItem[]
  studentWallet: StudentWalletSummary | null
  walletCreditInput: string
}) {
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
    () => getBillingMonthInRange(activeReceiptMonth, receiptBillingMonthOptions),
    [activeReceiptMonth, receiptBillingMonthOptions]
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

  return {
    activeReceiptBillingMonth,
    activeReceiptBillingYear,
    actualReceiptAmount,
    actualReceiptPaymentAmount,
    coursePayableAmount,
    extraPayableAmount,
    hasManualReceiptAmount,
    latestReceipt,
    payableAmount,
    receiptAmountSuggestions,
    receiptBillingMonthChoices,
    receiptBillingMonthOptions,
    receiptBillingYearOptions,
    receiptExtraLineSummaries,
    receiptLineSummaries,
    suggestedWalletCreditAmount,
    totalReceiptAmount,
    walletBalance,
    walletCreditAmount,
    receiptValidationErrors
  }
}
