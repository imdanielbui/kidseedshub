"use client"

import { BookOpenCheck, CreditCard, Pencil, Plus, Printer, Repeat2, Trash2 } from "lucide-react"
import Link from "next/link"
import type { FormEvent } from "react"
import type { ClassListItem, CourseListItem } from "@/lib/contracts/courses"
import type { PaymentMethodKey, ReceiptListItem } from "@/lib/contracts/finance"
import type { MakeupEntitlementItem } from "@/lib/contracts/makeup-entitlements"
import type { StudentDetail } from "@/lib/contracts/students"
import type { StudentWalletSummary } from "@/lib/contracts/student-wallet"
import {
  activeStudentCourses,
  getBillingMonthChoicesForYear,
  getBillingPeriodForMonth,
  getMonthPart,
  paymentMethods,
  toEnrollmentEditDraft,
  type BillingMonthOption,
  type EnrollmentEditDraft,
  type ReceiptBillingMode,
  type ReceiptDraftLine,
  type ReceiptExtraDraftLine
} from "./student-detail-utils"
import { DetailInput, EmptyState, FieldHint, FormFooter, InfoPill, SectionHeader } from "./student-detail-presentational"
import {
  EnrollmentTransferHistory,
  MakeupEntitlementCard,
  ReceiptHistoryCard,
  StudentWalletCard
} from "./student-detail-finance-cards"
import { formatDiscountInput, formatMoneyInput } from "./student-detail-money"

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

type StudentFinanceTabProps = {
  student: StudentDetail
  studentReceipts: ReceiptListItem[]
  studentWallet: StudentWalletSummary | null
  makeupEntitlements: MakeupEntitlementItem[]
  activeCourseOptions: CourseListItem[]
  classOptions: ClassListItem[]
  enrollmentCourseId: string
  enrollmentClassId: string
  enrollmentStartDate: string
  enrollmentFreeTrialSessions: string
  enrollmentSessions: string
  selectedEnrollmentCourse?: CourseListItem
  selectedEnrollmentPrice: number
  selectedEnrollmentUnitPrice: number
  enrollmentJoinPreview: JoinPreview
  enrollmentSessionsFromJoin: number
  isSubmittingEnrollment: boolean
  receiptBillingMode: ReceiptBillingMode
  isReceiptMonthlyBilling: boolean
  receiptBillingMonthOptions: BillingMonthOption[]
  receiptBillingMonthChoices: BillingMonthOption[]
  receiptBillingYearOptions: string[]
  activeReceiptBillingMonth: string
  activeReceiptBillingYear: string
  receiptLines: ReceiptDraftLine[]
  receiptLineSummaries: ReceiptLineSummary[]
  receiptExtraLineSummaries: ReceiptExtraLineSummary[]
  receiptMethod: PaymentMethodKey
  receiptNote: string
  receiptAmount: string
  receiptAmountSuggestions: number[]
  receiptValidationErrors: string[]
  isReceiptAmountOverride: boolean
  isWalletCreditManual: boolean
  walletCreditInput: string
  walletBalance: number
  suggestedWalletCreditAmount: number
  walletCreditAmount: number
  actualReceiptAmount: number
  actualReceiptPaymentAmount: number
  payableAmount: number
  coursePayableAmount: number
  extraPayableAmount: number
  latestReceipt: ReceiptListItem | null
  lastReceipt: ReceiptListItem | null
  totalReceiptAmount: number
  isSubmittingReceipt: boolean
  formatDate: (value: string) => string
  formatCurrency: (value: number) => string
  toNonNegativeIntegerInput: (value: string) => string
  setEnrollmentCourseId: (value: string) => void
  setEnrollmentClassId: (value: string) => void
  setEnrollmentStartDate: (value: string) => void
  setEnrollmentFreeTrialSessions: (value: string) => void
  setEnrollmentSessions: (value: string) => void
  setReceiptBillingMode: (value: ReceiptBillingMode) => void
  setReceiptAmount: (value: string) => void
  setIsReceiptAmountOverride: (value: boolean) => void
  setIsWalletCreditManual: (value: boolean) => void
  setReceiptBillingMonth: (value: string) => void
  setPendingBillableEnrollmentId: (value: string | null) => void
  setIsConfirmingReceiptAmount: (value: boolean) => void
  setWalletCreditInput: (value: string) => void
  setReceiptMethod: (value: PaymentMethodKey) => void
  setReceiptNote: (value: string) => void
  setEditingEnrollment: (value: EnrollmentEditDraft) => void
  submitEnrollment: (event: FormEvent<HTMLFormElement>) => void
  submitReceipt: (event: FormEvent<HTMLFormElement>) => void
  toggleReceiptLine: (course: StudentDetail["courses"][number]) => void
  openTransferDialog: (course: StudentDetail["courses"][number]) => void
  updateReceiptLine: (enrollmentId: string, patch: Partial<ReceiptDraftLine>) => void
  addReceiptExtraLine: () => void
  updateReceiptExtraLine: (id: string, patch: Partial<ReceiptExtraDraftLine>) => void
  removeReceiptExtraLine: (id: string) => void
}

export function StudentFinanceTab({
  student,
  studentReceipts,
  studentWallet,
  makeupEntitlements,
  activeCourseOptions,
  classOptions,
  enrollmentCourseId,
  enrollmentClassId,
  enrollmentStartDate,
  enrollmentFreeTrialSessions,
  enrollmentSessions,
  selectedEnrollmentCourse,
  selectedEnrollmentPrice,
  selectedEnrollmentUnitPrice,
  enrollmentJoinPreview,
  enrollmentSessionsFromJoin,
  isSubmittingEnrollment,
  receiptBillingMode,
  isReceiptMonthlyBilling,
  receiptBillingMonthOptions,
  receiptBillingMonthChoices,
  receiptBillingYearOptions,
  activeReceiptBillingMonth,
  activeReceiptBillingYear,
  receiptLineSummaries,
  receiptExtraLineSummaries,
  receiptMethod,
  receiptNote,
  receiptAmount,
  receiptAmountSuggestions,
  receiptValidationErrors,
  isReceiptAmountOverride,
  isWalletCreditManual,
  walletCreditInput,
  walletBalance,
  suggestedWalletCreditAmount,
  walletCreditAmount,
  actualReceiptAmount,
  actualReceiptPaymentAmount,
  payableAmount,
  coursePayableAmount,
  extraPayableAmount,
  latestReceipt,
  lastReceipt,
  totalReceiptAmount,
  isSubmittingReceipt,
  formatDate,
  formatCurrency,
  toNonNegativeIntegerInput,
  setEnrollmentCourseId,
  setEnrollmentClassId,
  setEnrollmentStartDate,
  setEnrollmentFreeTrialSessions,
  setEnrollmentSessions,
  setReceiptBillingMode,
  setReceiptAmount,
  setIsReceiptAmountOverride,
  setIsWalletCreditManual,
  setReceiptBillingMonth,
  setPendingBillableEnrollmentId,
  setIsConfirmingReceiptAmount,
  setWalletCreditInput,
  setReceiptMethod,
  setReceiptNote,
  setEditingEnrollment,
  submitEnrollment,
  submitReceipt,
  toggleReceiptLine,
  openTransferDialog,
  updateReceiptLine,
  addReceiptExtraLine,
  updateReceiptExtraLine,
  removeReceiptExtraLine
}: StudentFinanceTabProps) {
  const activeCourses = activeStudentCourses(student)

  return (
    <section className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <InfoPill label="Tổng còn lại" value={`${student.sessionsRemaining} buổi`} />
        <InfoPill label="Khóa đang hoạt động" value={`${activeCourses.length} khóa`} />
        <InfoPill label="Đã thu tất cả" value={studentReceipts.length ? formatCurrency(totalReceiptAmount) : "Chưa có phiếu"} />
        <InfoPill label="Số dư credit" value={studentWallet ? formatCurrency(walletBalance) : "Chưa có ví"} />
        <InfoPill label="Phiếu thu gần nhất" value={latestReceipt ? `${latestReceipt.code} · ${formatCurrency(Number(latestReceipt.amount))}` : "Chưa có phiếu"} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <StudentWalletCard summary={studentWallet} formatDate={formatDate} formatCurrency={formatCurrency} />
        <MakeupEntitlementCard entitlements={makeupEntitlements} formatDate={formatDate} formatCurrency={formatCurrency} />
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
            <div className="grid gap-3 md:col-span-2 md:grid-cols-5">
              <InfoPill label="Giá nguyên khóa" value={selectedEnrollmentCourse ? formatCurrency(selectedEnrollmentPrice) : "Chưa chọn"} />
              <InfoPill label="Tổng buổi khóa" value={selectedEnrollmentCourse ? `${selectedEnrollmentCourse.totalSessions} buổi` : "Chưa chọn"} />
              <InfoPill label="Đơn giá/buổi" value={selectedEnrollmentCourse ? formatCurrency(selectedEnrollmentUnitPrice) : "Chưa chọn"} />
              <InfoPill label="Bé sẽ bắt đầu từ buổi" value={selectedEnrollmentCourse ? `${enrollmentJoinPreview.joinSessionNumber}/${selectedEnrollmentCourse.totalSessions}` : "Chưa chọn"} />
              <InfoPill label="Số buổi tính phí còn lại" value={selectedEnrollmentCourse ? `${enrollmentSessionsFromJoin} buổi` : "Chưa chọn"} />
            </div>
            {enrollmentJoinPreview.warning ? (
              <p className="rounded-2xl border border-brand-red/10 bg-white/45 px-3 py-2 text-xs font-semibold text-stone-500 md:col-span-2">{enrollmentJoinPreview.warning}</p>
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
                receiptBillingMonthOptions.length ? (
                  <>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <label>
                        <span className="text-xs font-semibold text-stone-500">Tháng</span>
                        <select
                          className="neu-pressed mt-1 w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none"
                          value={getMonthPart(activeReceiptBillingMonth)}
                          onChange={(event) => setReceiptBillingMonth(`${activeReceiptBillingYear}-${event.target.value}`)}
                        >
                          {receiptBillingMonthChoices.map((choice) => (
                            <option key={choice.value} value={choice.month}>{choice.label}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span className="text-xs font-semibold text-stone-500">Năm</span>
                        <select
                          className="neu-pressed mt-1 w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none"
                          value={activeReceiptBillingYear}
                          onChange={(event) => {
                            const yearMonthOptions = getBillingMonthChoicesForYear(receiptBillingMonthOptions, event.target.value)
                            const month = yearMonthOptions.some((option) => option.month === getMonthPart(activeReceiptBillingMonth))
                              ? getMonthPart(activeReceiptBillingMonth)
                              : (yearMonthOptions[0]?.month ?? "01")
                            setReceiptBillingMonth(`${event.target.value}-${month}`)
                          }}
                        >
                          {receiptBillingYearOptions.map((year) => (
                            <option key={year} value={year}>{year}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <span className="mt-1 block text-xs text-stone-500">Hệ thống đếm các buổi trong tháng này từ lịch lớp, bỏ qua buổi nghỉ/hủy.</span>
                  </>
                ) : (
                  <p className="mt-3 rounded-2xl border border-brand-red/10 bg-white/45 px-4 py-3 text-sm font-semibold text-stone-500">
                    Các khóa đã chọn chưa có lịch lớp hoặc ngày học hợp lệ để chọn kỳ thu theo tháng.
                  </p>
                )
              ) : null}
            </div>
            <div>
              <p className="text-sm font-semibold text-stone-700">Khóa cần thu</p>
              <div className="mt-2 grid gap-2">
                {activeCourses.length ? activeCourses.map((course) => {
                  const selected = receiptLineSummaries.some((summary) => summary.line.enrollmentId === course.enrollmentId)

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
                              : `Kỳ ${getBillingPeriodForMonth(activeReceiptBillingMonth).label}: ${summary.monthlySessions} buổi lịch lớp, đã thu ${summary.billedThisMonth} buổi.`)
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
      <EnrollmentTransferHistory transfers={student.enrollmentTransfers} formatDate={formatDate} formatCurrency={formatCurrency} />
      <ReceiptHistoryCard receipts={studentReceipts} formatDate={formatDate} formatCurrency={formatCurrency} />
    </section>
  )
}
