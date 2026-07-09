"use client"

import { useCallback, useMemo, useState } from "react"
import type { ApiResponse } from "@/lib/api-response"
import type { EnrollmentTransferResult } from "@/lib/contracts/enrollment-transfers"
import type { EnrollmentDeleteResult } from "@/lib/contracts/enrollments"
import type { PaymentMethodKey, ReceiptListItem } from "@/lib/contracts/finance"
import { type ParentAccountInfo, type StudentDetail, type StudentStatusKey } from "@/lib/contracts/students"
import {
  calculateClassJoinPreview,
  getBillingPeriodForMonth,
  getCurrentMonth,
  toReceiptDraftLine,
  type DetailTab,
  type EnrollmentEditDraft,
  type EnrollmentTransferDraft,
  type LearningDetailTarget,
  type ParentAccountAction,
  type ReceiptBillingMode,
  type ReceiptDraftLine,
  type ReceiptExtraDraftLine
} from "./student-detail-utils"
import { formatMoneyInput } from "./student-detail-money"
import { StudentDetailMissingState, StudentDetailWorkspace } from "./student-detail-workspace"
import { toNonNegativeIntegerInput, toNonNegativeNumber, useStudentReceiptState } from "./student-detail-receipt-state"
import { useStudentDetailData } from "./student-detail-data"
import { useStudentEngagementState } from "./student-detail-engagement-state"
import { formatCurrency, formatDate, formatWeekday } from "./student-detail-format"

export function StudentDetailClient({ studentId }: { studentId: string }) {
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
  const [walletCreditInput, setWalletCreditInput] = useState("")
  const [isWalletCreditManual, setIsWalletCreditManual] = useState(false)
  const [temporaryParentPassword, setTemporaryParentPassword] = useState<string | null>(null)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isSubmittingEnrollment, setIsSubmittingEnrollment] = useState(false)
  const [isUpdatingEnrollment, setIsUpdatingEnrollment] = useState(false)
  const [isDeletingEnrollment, setIsDeletingEnrollment] = useState(false)
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false)
  const [isSubmittingReceipt, setIsSubmittingReceipt] = useState(false)
  const [isUpdatingParentAccount, setIsUpdatingParentAccount] = useState(false)

  const syncProfileForm = useCallback((nextStudent: StudentDetail) => {
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
  }, [])

  const {
    classes,
    courses,
    error,
    isLoading,
    lastReceipt,
    loadFinanceLedger,
    loadReceipts,
    loadStudent,
    makeupEntitlements,
    photoCaptionDrafts,
    setError,
    setLastReceipt,
    setPhotoCaptionDrafts,
    setStudent,
    student,
    studentReceipts,
    studentWallet
  } = useStudentDetailData({
    setEnrollmentCourseId,
    setReceiptLines,
    studentId,
    syncProfileForm
  })
  const {
    content,
    deleteStudentPhoto,
    filteredPhotos,
    isSubmittingLog,
    isSubmittingTask,
    markTaskDone,
    patchStudentPhoto,
    photoCourseFilter,
    photoCourseOptions,
    photoDateFrom,
    photoDateTo,
    photoReviewFilter,
    photoSavingId,
    result,
    savingTaskId,
    setContent,
    setPhotoCourseFilter,
    setPhotoDateFrom,
    setPhotoDateTo,
    setPhotoReviewFilter,
    setResult,
    setTaskDueDate,
    setTaskNote,
    setTaskTitle,
    submitContactLog,
    submitTask,
    taskDueDate,
    taskNote,
    taskTitle
  } = useStudentEngagementState({
    loadStudent,
    setError,
    setStudent,
    student,
    studentId
  })

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
  const {
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
    totalReceiptAmount,
    walletBalance,
    walletCreditAmount,
    receiptValidationErrors
  } = useStudentReceiptState({
    activeReceiptMonth: receiptBillingMonth,
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
  })

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
    return <StudentDetailMissingState error={error} />
  }

  return (
    <StudentDetailWorkspace
      activeCourseOptions={activeCourseOptions}
      activeReceiptBillingMonth={activeReceiptBillingMonth}
      activeReceiptBillingYear={activeReceiptBillingYear}
      activeTab={activeTab}
      actualReceiptAmount={actualReceiptAmount}
      actualReceiptPaymentAmount={actualReceiptPaymentAmount}
      addReceiptExtraLine={addReceiptExtraLine}
      classOptions={classOptions}
      content={content}
      coursePayableAmount={coursePayableAmount}
      editingClassOptions={editingClassOptions}
      editingCourse={editingCourse}
      editingEnrollment={editingEnrollment}
      editingJoinPreview={editingJoinPreview}
      enrollmentClassId={enrollmentClassId}
      enrollmentCourseId={enrollmentCourseId}
      enrollmentFreeTrialSessions={enrollmentFreeTrialSessions}
      enrollmentJoinPreview={enrollmentJoinPreview}
      enrollmentSessions={enrollmentSessions}
      enrollmentSessionsFromJoin={enrollmentSessionsFromJoin}
      enrollmentStartDate={enrollmentStartDate}
      error={error}
      extraPayableAmount={extraPayableAmount}
      filteredPhotos={filteredPhotos}
      formatCurrency={formatCurrency}
      formatDate={formatDate}
      formatWeekday={formatWeekday}
      isConfirmingEnrollmentDelete={isConfirmingEnrollmentDelete}
      isConfirmingPayment={isConfirmingPayment}
      isConfirmingReceiptAmount={isConfirmingReceiptAmount}
      isCourseTransfer={isCourseTransfer}
      isDeletingEnrollment={isDeletingEnrollment}
      isReceiptAmountOverride={isReceiptAmountOverride}
      isReceiptMonthlyBilling={isReceiptMonthlyBilling}
      isSavingProfile={isSavingProfile}
      isSubmittingEnrollment={isSubmittingEnrollment}
      isSubmittingLog={isSubmittingLog}
      isSubmittingReceipt={isSubmittingReceipt}
      isSubmittingTask={isSubmittingTask}
      isSubmittingTransfer={isSubmittingTransfer}
      isUpdatingEnrollment={isUpdatingEnrollment}
      isUpdatingParentAccount={isUpdatingParentAccount}
      isWalletCreditManual={isWalletCreditManual}
      lastReceipt={lastReceipt}
      latestReceipt={latestReceipt}
      makeupEntitlements={makeupEntitlements}
      markTaskDone={(taskId) => void markTaskDone(taskId)}
      openTransferDialog={openTransferDialog}
      payableAmount={payableAmount}
      pendingBillableEnrollmentId={pendingBillableEnrollmentId}
      photoCaptionDrafts={photoCaptionDrafts}
      photoCourseFilter={photoCourseFilter}
      photoCourseOptions={photoCourseOptions}
      photoDateFrom={photoDateFrom}
      photoDateTo={photoDateTo}
      photoReviewFilter={photoReviewFilter}
      photoSavingId={photoSavingId}
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
      receiptAmount={receiptAmount}
      receiptAmountSuggestions={receiptAmountSuggestions}
      receiptBillingMode={receiptBillingMode}
      receiptBillingMonthChoices={receiptBillingMonthChoices}
      receiptBillingMonthOptions={receiptBillingMonthOptions}
      receiptBillingYearOptions={receiptBillingYearOptions}
      receiptExtraLineSummaries={receiptExtraLineSummaries}
      receiptLineSummaries={receiptLineSummaries}
      receiptLines={receiptLines}
      receiptMethod={receiptMethod}
      receiptNote={receiptNote}
      receiptValidationErrors={receiptValidationErrors}
      removeReceiptExtraLine={removeReceiptExtraLine}
      result={result}
      savingTaskId={savingTaskId}
      selectedEnrollmentCourse={selectedEnrollmentCourse}
      selectedEnrollmentPrice={selectedEnrollmentPrice}
      selectedEnrollmentUnitPrice={selectedEnrollmentUnitPrice}
      selectedLearningDetail={selectedLearningDetail}
      setActiveTab={setActiveTab}
      setContent={setContent}
      setEditingEnrollment={setEditingEnrollment}
      setEnrollmentClassId={setEnrollmentClassId}
      setEnrollmentCourseId={setEnrollmentCourseId}
      setEnrollmentFreeTrialSessions={setEnrollmentFreeTrialSessions}
      setEnrollmentSessions={setEnrollmentSessions}
      setEnrollmentStartDate={setEnrollmentStartDate}
      setIsConfirmingEnrollmentDelete={setIsConfirmingEnrollmentDelete}
      setIsConfirmingPayment={setIsConfirmingPayment}
      setIsConfirmingReceiptAmount={setIsConfirmingReceiptAmount}
      setIsReceiptAmountOverride={setIsReceiptAmountOverride}
      setIsWalletCreditManual={setIsWalletCreditManual}
      setPendingBillableEnrollmentId={setPendingBillableEnrollmentId}
      setPhotoCaptionDrafts={setPhotoCaptionDrafts}
      setPhotoCourseFilter={setPhotoCourseFilter}
      setPhotoDateFrom={setPhotoDateFrom}
      setPhotoDateTo={setPhotoDateTo}
      setPhotoReviewFilter={setPhotoReviewFilter}
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
      setReceiptAmount={setReceiptAmount}
      setReceiptBillingMode={setReceiptBillingMode}
      setReceiptBillingMonth={setReceiptBillingMonth}
      setReceiptMethod={setReceiptMethod}
      setReceiptNote={setReceiptNote}
      setResult={setResult}
      setSelectedLearningDetail={setSelectedLearningDetail}
      setTaskDueDate={setTaskDueDate}
      setTaskNote={setTaskNote}
      setTaskTitle={setTaskTitle}
      setTransferDraft={setTransferDraft}
      setWalletCreditInput={setWalletCreditInput}
      student={student}
      studentReceipts={studentReceipts}
      studentWallet={studentWallet}
      submitContactLog={submitContactLog}
      submitEnrollment={submitEnrollment}
      submitEnrollmentEdit={submitEnrollmentEdit}
      submitProfile={submitProfile}
      submitReceipt={submitReceipt}
      submitTask={submitTask}
      submitTransfer={submitTransfer}
      taskDueDate={taskDueDate}
      taskNote={taskNote}
      taskTitle={taskTitle}
      temporaryParentPassword={temporaryParentPassword}
      toNonNegativeIntegerInput={toNonNegativeIntegerInput}
      toggleReceiptLine={toggleReceiptLine}
      totalReceiptAmount={totalReceiptAmount}
      transferClassOptions={transferClassOptions}
      transferCreditPreview={transferCreditPreview}
      transferDraft={transferDraft}
      transferRemainingSessions={transferRemainingSessions}
      transferSourceCourse={transferSourceCourse}
      transferTargetCourse={transferTargetCourse}
      transferTargetPrice={transferTargetPrice}
      transferTopUpPreview={transferTopUpPreview}
      updateParentAccount={(action) => void updateParentAccount(action)}
      updateReceiptExtraLine={updateReceiptExtraLine}
      updateReceiptLine={updateReceiptLine}
      walletBalance={walletBalance}
      walletCreditAmount={walletCreditAmount}
      walletCreditInput={walletCreditInput}
      onConfirmBillableOverride={confirmBillableOverride}
      onConfirmReceiptAmountOverride={confirmReceiptAmountOverride}
      onConfirmReceiptPayment={() => void confirmReceiptPayment()}
      onDeleteEnrollment={() => {
        if (!isDeletingEnrollment) void deleteOrCancelEnrollment()
      }}
      onDeletePhoto={(photoId) => void deleteStudentPhoto(photoId)}
      onPatchPhoto={(photoId, body) => void patchStudentPhoto(photoId, body)}
    />
  )
}
