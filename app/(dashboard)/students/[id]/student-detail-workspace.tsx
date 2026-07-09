"use client"

import { ArrowLeft, UserRound } from "lucide-react"
import Link from "next/link"
import type { Dispatch, FormEvent, SetStateAction } from "react"
import type { ClassListItem, CourseListItem } from "@/lib/contracts/courses"
import type { ContactResultKey } from "@/lib/contracts/crm"
import type { PaymentMethodKey, ReceiptListItem } from "@/lib/contracts/finance"
import type { MakeupEntitlementItem } from "@/lib/contracts/makeup-entitlements"
import { studentStatusLabels, type StudentDetail, type StudentStatusKey } from "@/lib/contracts/students"
import type { StudentWalletSummary } from "@/lib/contracts/student-wallet"
import { ConfirmDialog, LearningDetailDialog, ReceiptPaymentConfirmDialog } from "./student-detail-dialogs"
import { StudentEnrollmentDialogs } from "./student-detail-enrollment-dialogs"
import { StudentFinanceTab } from "./student-detail-finance-tab"
import { StudentJournalTab } from "./student-detail-journal-tab"
import { ParentAccountTab, StudentCrmTab, StudentLearningTab, StudentOverviewTab } from "./student-detail-tabs"
import {
  detailTabs,
  type BillingMonthOption,
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

type ReceiptLineSummary = {
  line: ReceiptDraftLine
  course?: StudentDetail["courses"][number]
  unitPrice: number
  billableSessions: number
  freeTrialSessions: number
  paidSessionsBeforeReceipt: number
  monthlySessions?: number
  billedThisMonth: number
  grossAmount: number
  discount: { label: string; discountAmount: number; discountPercent: number; totalDiscount: number }
  amount: number
  remainingAfterReceipt: number
}

type ReceiptExtraLineSummary = {
  line: ReceiptExtraDraftLine
  quantity: number
  unitPrice: number
  amount: number
}

type JoinPreview = {
  joinSessionNumber: number
  sessionsFromJoin: number
  warning?: string
}

type StudentDetailWorkspaceProps = {
  activeCourseOptions: CourseListItem[]
  activeReceiptBillingMonth: string
  activeReceiptBillingYear: string
  activeTab: DetailTab
  actualReceiptAmount: number
  actualReceiptPaymentAmount: number
  addReceiptExtraLine: () => void
  classOptions: ClassListItem[]
  content: string
  coursePayableAmount: number
  editingClassOptions: ClassListItem[]
  editingCourse?: StudentDetail["courses"][number]
  editingEnrollment: EnrollmentEditDraft | null
  editingJoinPreview: JoinPreview
  enrollmentClassId: string
  enrollmentCourseId: string
  enrollmentFreeTrialSessions: string
  enrollmentJoinPreview: JoinPreview
  enrollmentSessions: string
  enrollmentSessionsFromJoin: number
  enrollmentStartDate: string
  error: string | null
  extraPayableAmount: number
  filteredPhotos: StudentDetail["photos"]
  formatCurrency: (value: number) => string
  formatDate: (value: string) => string
  formatWeekday: (weekday: number) => string
  isConfirmingEnrollmentDelete: boolean
  isConfirmingPayment: boolean
  isConfirmingReceiptAmount: boolean
  isCourseTransfer: boolean
  isDeletingEnrollment: boolean
  isReceiptAmountOverride: boolean
  isReceiptMonthlyBilling: boolean
  isSavingProfile: boolean
  isSubmittingEnrollment: boolean
  isSubmittingLog: boolean
  isSubmittingReceipt: boolean
  isSubmittingTask: boolean
  isSubmittingTransfer: boolean
  isUpdatingEnrollment: boolean
  isUpdatingParentAccount: boolean
  isWalletCreditManual: boolean
  lastReceipt: ReceiptListItem | null
  latestReceipt: ReceiptListItem | null
  makeupEntitlements: MakeupEntitlementItem[]
  markTaskDone: (taskId: string) => void
  openTransferDialog: (course: StudentDetail["courses"][number]) => void
  payableAmount: number
  pendingBillableEnrollmentId: string | null
  photoCaptionDrafts: Record<string, string>
  photoCourseFilter: string
  photoCourseOptions: string[]
  photoDateFrom: string
  photoDateTo: string
  photoReviewFilter: PhotoReviewFilter
  photoSavingId: string | null
  profileAddress: string
  profileBirthDate: string
  profileHealthNote: string
  profileLeadNote: string
  profileLeadSource: string
  profileName: string
  profileParentEmail: string
  profileParentName: string
  profileParentPhone: string
  profileStatus: StudentStatusKey
  receiptAmount: string
  receiptAmountSuggestions: number[]
  receiptBillingMode: ReceiptBillingMode
  receiptBillingMonthChoices: BillingMonthOption[]
  receiptBillingMonthOptions: BillingMonthOption[]
  receiptBillingYearOptions: string[]
  receiptExtraLineSummaries: ReceiptExtraLineSummary[]
  receiptLineSummaries: ReceiptLineSummary[]
  receiptLines: ReceiptDraftLine[]
  receiptMethod: PaymentMethodKey
  receiptNote: string
  receiptValidationErrors: string[]
  removeReceiptExtraLine: (id: string) => void
  result: ContactResultKey
  savingTaskId: string | null
  selectedEnrollmentCourse?: CourseListItem
  selectedEnrollmentPrice: number
  selectedEnrollmentUnitPrice: number
  selectedLearningDetail: LearningDetailTarget | null
  setActiveTab: (value: DetailTab) => void
  setContent: (value: string) => void
  setEditingEnrollment: Dispatch<SetStateAction<EnrollmentEditDraft | null>>
  setEnrollmentClassId: (value: string) => void
  setEnrollmentCourseId: (value: string) => void
  setEnrollmentFreeTrialSessions: (value: string) => void
  setEnrollmentSessions: (value: string) => void
  setEnrollmentStartDate: (value: string) => void
  setIsConfirmingEnrollmentDelete: (value: boolean) => void
  setIsConfirmingPayment: (value: boolean) => void
  setIsConfirmingReceiptAmount: (value: boolean) => void
  setIsReceiptAmountOverride: (value: boolean) => void
  setIsWalletCreditManual: (value: boolean) => void
  setPendingBillableEnrollmentId: (value: string | null) => void
  setPhotoCaptionDrafts: Dispatch<SetStateAction<Record<string, string>>>
  setPhotoCourseFilter: (value: string) => void
  setPhotoDateFrom: (value: string) => void
  setPhotoDateTo: (value: string) => void
  setPhotoReviewFilter: (value: PhotoReviewFilter) => void
  setProfileAddress: (value: string) => void
  setProfileBirthDate: (value: string) => void
  setProfileHealthNote: (value: string) => void
  setProfileLeadNote: (value: string) => void
  setProfileLeadSource: (value: string) => void
  setProfileName: (value: string) => void
  setProfileParentEmail: (value: string) => void
  setProfileParentName: (value: string) => void
  setProfileParentPhone: (value: string) => void
  setProfileStatus: (value: StudentStatusKey) => void
  setReceiptAmount: (value: string) => void
  setReceiptBillingMode: (value: ReceiptBillingMode) => void
  setReceiptBillingMonth: (value: string) => void
  setReceiptMethod: (value: PaymentMethodKey) => void
  setReceiptNote: (value: string) => void
  setResult: (value: ContactResultKey) => void
  setSelectedLearningDetail: (value: LearningDetailTarget | null) => void
  setTaskDueDate: (value: string) => void
  setTaskNote: (value: string) => void
  setTaskTitle: (value: string) => void
  setTransferDraft: Dispatch<SetStateAction<EnrollmentTransferDraft | null>>
  setWalletCreditInput: (value: string) => void
  student: StudentDetail
  studentReceipts: ReceiptListItem[]
  studentWallet: StudentWalletSummary | null
  submitContactLog: (event: FormEvent<HTMLFormElement>) => void
  submitEnrollment: (event: FormEvent<HTMLFormElement>) => void
  submitEnrollmentEdit: (event: FormEvent<HTMLFormElement>) => void
  submitProfile: (event: FormEvent<HTMLFormElement>) => void
  submitReceipt: (event: FormEvent<HTMLFormElement>) => void
  submitTask: (event: FormEvent<HTMLFormElement>) => void
  submitTransfer: (event: FormEvent<HTMLFormElement>) => void
  taskDueDate: string
  taskNote: string
  taskTitle: string
  temporaryParentPassword: string | null
  toNonNegativeIntegerInput: (value: string) => string
  toggleReceiptLine: (course: StudentDetail["courses"][number]) => void
  totalReceiptAmount: number
  transferClassOptions: ClassListItem[]
  transferCreditPreview: number
  transferDraft: EnrollmentTransferDraft | null
  transferRemainingSessions: number
  transferSourceCourse?: StudentDetail["courses"][number]
  transferTargetCourse?: CourseListItem
  transferTargetPrice: number
  transferTopUpPreview: number
  updateParentAccount: (action: ParentAccountAction) => void
  updateReceiptExtraLine: (id: string, patch: Partial<ReceiptExtraDraftLine>) => void
  updateReceiptLine: (enrollmentId: string, patch: Partial<ReceiptDraftLine>) => void
  walletBalance: number
  walletCreditAmount: number
  walletCreditInput: string
  onConfirmBillableOverride: () => void
  onConfirmReceiptAmountOverride: () => void
  onConfirmReceiptPayment: () => void
  onDeleteEnrollment: () => void
  onDeletePhoto: (photoId: string) => void
  onPatchPhoto: (photoId: string, body: { caption?: string | null; isFeatured?: boolean; isPublished?: boolean; markSent?: boolean }) => void
}

export function StudentDetailWorkspace(props: StudentDetailWorkspaceProps) {
  const {
    activeCourseOptions,
    activeReceiptBillingMonth,
    activeReceiptBillingYear,
    activeTab,
    actualReceiptAmount,
    actualReceiptPaymentAmount,
    addReceiptExtraLine,
    classOptions,
    content,
    coursePayableAmount,
    editingClassOptions,
    editingCourse,
    editingEnrollment,
    editingJoinPreview,
    enrollmentClassId,
    enrollmentCourseId,
    enrollmentFreeTrialSessions,
    enrollmentJoinPreview,
    enrollmentSessions,
    enrollmentSessionsFromJoin,
    enrollmentStartDate,
    error,
    extraPayableAmount,
    filteredPhotos,
    formatCurrency,
    formatDate,
    formatWeekday,
    isConfirmingEnrollmentDelete,
    isConfirmingPayment,
    isConfirmingReceiptAmount,
    isCourseTransfer,
    isDeletingEnrollment,
    isReceiptAmountOverride,
    isReceiptMonthlyBilling,
    isSavingProfile,
    isSubmittingEnrollment,
    isSubmittingLog,
    isSubmittingReceipt,
    isSubmittingTask,
    isSubmittingTransfer,
    isUpdatingEnrollment,
    isUpdatingParentAccount,
    isWalletCreditManual,
    lastReceipt,
    latestReceipt,
    makeupEntitlements,
    markTaskDone,
    openTransferDialog,
    payableAmount,
    pendingBillableEnrollmentId,
    photoCaptionDrafts,
    photoCourseFilter,
    photoCourseOptions,
    photoDateFrom,
    photoDateTo,
    photoReviewFilter,
    photoSavingId,
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
    receiptAmount,
    receiptAmountSuggestions,
    receiptBillingMode,
    receiptBillingMonthChoices,
    receiptBillingMonthOptions,
    receiptBillingYearOptions,
    receiptExtraLineSummaries,
    receiptLineSummaries,
    receiptLines,
    receiptMethod,
    receiptNote,
    receiptValidationErrors,
    removeReceiptExtraLine,
    result,
    savingTaskId,
    selectedEnrollmentCourse,
    selectedEnrollmentPrice,
    selectedEnrollmentUnitPrice,
    selectedLearningDetail,
    setActiveTab,
    setContent,
    setEditingEnrollment,
    setEnrollmentClassId,
    setEnrollmentCourseId,
    setEnrollmentFreeTrialSessions,
    setEnrollmentSessions,
    setEnrollmentStartDate,
    setIsConfirmingEnrollmentDelete,
    setIsConfirmingPayment,
    setIsConfirmingReceiptAmount,
    setIsReceiptAmountOverride,
    setIsWalletCreditManual,
    setPendingBillableEnrollmentId,
    setPhotoCaptionDrafts,
    setPhotoCourseFilter,
    setPhotoDateFrom,
    setPhotoDateTo,
    setPhotoReviewFilter,
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
    setReceiptAmount,
    setReceiptBillingMode,
    setReceiptBillingMonth,
    setReceiptMethod,
    setReceiptNote,
    setResult,
    setSelectedLearningDetail,
    setTaskDueDate,
    setTaskNote,
    setTaskTitle,
    setTransferDraft,
    setWalletCreditInput,
    student,
    studentReceipts,
    studentWallet,
    submitContactLog,
    submitEnrollment,
    submitEnrollmentEdit,
    submitProfile,
    submitReceipt,
    submitTask,
    submitTransfer,
    taskDueDate,
    taskNote,
    taskTitle,
    temporaryParentPassword,
    toNonNegativeIntegerInput,
    toggleReceiptLine,
    totalReceiptAmount,
    transferClassOptions,
    transferCreditPreview,
    transferDraft,
    transferRemainingSessions,
    transferSourceCourse,
    transferTargetCourse,
    transferTargetPrice,
    transferTopUpPreview,
    updateParentAccount,
    updateReceiptExtraLine,
    updateReceiptLine,
    walletBalance,
    walletCreditAmount,
    walletCreditInput,
    onConfirmBillableOverride,
    onConfirmReceiptAmountOverride,
    onConfirmReceiptPayment,
    onDeleteEnrollment,
    onDeletePhoto,
    onPatchPhoto
  } = props

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
          markTaskDone={(taskId) => markTaskDone(taskId)}
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
          suggestedWalletCreditAmount={Math.min(walletBalance, actualReceiptAmount)}
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
          onDeletePhoto={(photoId) => onDeletePhoto(photoId)}
          onPatchPhoto={(photoId, body) => onPatchPhoto(photoId, body)}
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
          updateParentAccount={(action) => updateParentAccount(action)}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(pendingBillableEnrollmentId)}
        title="Sửa số buổi tính phí?"
        description="Số buổi này đang được hệ thống tự tính từ khóa đã đăng ký. Chỉ sửa tay khi trường hợp thu học phí có ngoại lệ."
        confirmLabel="Cho phép sửa"
        onCancel={() => setPendingBillableEnrollmentId(null)}
        onConfirm={onConfirmBillableOverride}
      />

      <ConfirmDialog
        open={isConfirmingReceiptAmount}
        title="Sửa số tiền thanh toán?"
        description="Số tiền phụ huynh cần thanh toán đang được tính tự động từ các dòng khóa và giảm giá. Nếu sửa tay, hệ thống sẽ lưu tổng phiếu theo số tiền bạn nhập."
        confirmLabel="Cho phép sửa"
        onCancel={() => setIsConfirmingReceiptAmount(false)}
        onConfirm={onConfirmReceiptAmountOverride}
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
        onConfirm={onConfirmReceiptPayment}
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
        onConfirm={onDeleteEnrollment}
      />

      <LearningDetailDialog
        target={selectedLearningDetail}
        onClose={() => setSelectedLearningDetail(null)}
        formatDate={formatDate}
        formatCurrency={formatCurrency}
        formatWeekday={formatWeekday}
      />

      <StudentEnrollmentDialogs
        transferDraft={transferDraft}
        transferSourceCourse={transferSourceCourse}
        transferRemainingSessions={transferRemainingSessions}
        transferCreditPreview={transferCreditPreview}
        transferTargetPrice={transferTargetPrice}
        transferTopUpPreview={transferTopUpPreview}
        transferTargetCourse={transferTargetCourse}
        transferClassOptions={transferClassOptions}
        activeCourseOptions={activeCourseOptions}
        isCourseTransfer={isCourseTransfer}
        isSubmittingTransfer={isSubmittingTransfer}
        editingEnrollment={editingEnrollment}
        editingCourse={editingCourse}
        editingClassOptions={editingClassOptions}
        editingJoinPreview={editingJoinPreview}
        isUpdatingEnrollment={isUpdatingEnrollment}
        isDeletingEnrollment={isDeletingEnrollment}
        formatCurrency={formatCurrency}
        toNonNegativeIntegerInput={toNonNegativeIntegerInput}
        setTransferDraft={setTransferDraft}
        setEditingEnrollment={setEditingEnrollment}
        setIsConfirmingEnrollmentDelete={setIsConfirmingEnrollmentDelete}
        submitTransfer={submitTransfer}
        submitEnrollmentEdit={submitEnrollmentEdit}
      />
    </main>
  )
}
