"use client"

import { useEffect, useMemo, useState } from "react"
import type { PaymentMethodKey } from "@/lib/contracts/finance"
import {
  calculateClassJoinPreview,
  getCurrentMonth,
  type DetailTab,
  type EnrollmentEditDraft,
  type EnrollmentTransferDraft,
  type LearningDetailTarget,
  type ReceiptBillingMode,
  type ReceiptDraftLine,
  type ReceiptExtraDraftLine
} from "./student-detail-utils"
import { StudentDetailMissingState, StudentDetailWorkspace } from "./student-detail-workspace"
import { toNonNegativeIntegerInput, useStudentReceiptState } from "./student-detail-receipt-state"
import { useStudentDetailData } from "./student-detail-data"
import { useStudentEnrollmentActions } from "./student-detail-enrollment-actions"
import { useStudentReceiptActions } from "./student-detail-receipt-actions"
import { useStudentEngagementState } from "./student-detail-engagement-state"
import { formatCurrency, formatDate, formatWeekday } from "./student-detail-format"
import { useStudentProfileState } from "./student-detail-profile-state"
import { useStudentParentAccountActions } from "./student-detail-parent-account-actions"

export function StudentDetailClient({ studentId }: { studentId: string }) {
  const [activeTab, setActiveTab] = useState<DetailTab>("overview")
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
  const [isSubmittingEnrollment, setIsSubmittingEnrollment] = useState(false)
  const [isUpdatingEnrollment, setIsUpdatingEnrollment] = useState(false)
  const [isDeletingEnrollment, setIsDeletingEnrollment] = useState(false)
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false)
  const [isSubmittingReceipt, setIsSubmittingReceipt] = useState(false)
  const [isUpdatingParentAccount, setIsUpdatingParentAccount] = useState(false)

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
    studentId
  })
  const {
    isSavingProfile,
    profileAddress,
    profileBirthDate,
    profileHealthNote,
    profileLeadNote,
    profileLeadSource,
    profileName,
    profileParentEmail,
    profileParentName,
    profileParentPhone,
    profileStatus,
    setProfileAddress,
    setProfileBirthDate,
    setProfileHealthNote,
    setProfileLeadNote,
    setProfileLeadSource,
    setProfileName,
    setProfileParentEmail,
    setProfileParentName,
    setProfileParentPhone,
    setProfileStatus,
    submitProfile,
    syncProfileForm
  } = useStudentProfileState({
    setError,
    setPhotoCaptionDrafts,
    setStudent,
    studentId
  })
  useEffect(() => {
    if (student) syncProfileForm(student)
  }, [student, syncProfileForm])
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
  const {
    deleteOrCancelEnrollment,
    openTransferDialog,
    submitEnrollment,
    submitEnrollmentEdit,
    submitTransfer
  } = useStudentEnrollmentActions({
    editingEnrollment,
    enrollmentClassId,
    enrollmentCourseId,
    enrollmentFreeTrialSessions,
    enrollmentSessions,
    enrollmentStartDate,
    loadFinanceLedger,
    loadStudent,
    selectedEnrollmentCourse,
    setEditingEnrollment,
    setEnrollmentClassId,
    setEnrollmentFreeTrialSessions,
    setEnrollmentSessions,
    setError,
    setIsConfirmingEnrollmentDelete,
    setIsDeletingEnrollment,
    setIsReceiptAmountOverride,
    setIsSubmittingEnrollment,
    setIsSubmittingTransfer,
    setIsUpdatingEnrollment,
    setIsWalletCreditManual,
    setReceiptAmount,
    setReceiptLines,
    setTransferDraft,
    studentId,
    transferDraft
  })

  const {
    addReceiptExtraLine,
    confirmBillableOverride,
    confirmReceiptAmountOverride,
    confirmReceiptPayment,
    removeReceiptExtraLine,
    submitReceipt,
    toggleReceiptLine,
    updateReceiptExtraLine,
    updateReceiptLine
  } = useStudentReceiptActions({
    activeReceiptBillingMonth,
    actualReceiptAmount,
    hasManualReceiptAmount,
    isReceiptMonthlyBilling,
    loadFinanceLedger,
    loadReceipts,
    loadStudent,
    payableAmount,
    pendingBillableEnrollmentId,
    receiptExtraLineSummaries,
    receiptLineSummaries,
    receiptMethod,
    receiptNote,
    receiptValidationErrors,
    setError,
    setIsConfirmingPayment,
    setIsConfirmingReceiptAmount,
    setIsReceiptAmountOverride,
    setIsSubmittingReceipt,
    setIsWalletCreditManual,
    setLastReceipt,
    setPendingBillableEnrollmentId,
    setReceiptAmount,
    setReceiptBillingMode,
    setReceiptExtraLines,
    setReceiptLines,
    setReceiptNote,
    setWalletCreditInput,
    studentId,
    walletCreditAmount
  })
  const { updateParentAccount } = useStudentParentAccountActions({
    setError,
    setIsUpdatingParentAccount,
    setStudent,
    setTemporaryParentPassword,
    studentId
  })

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
