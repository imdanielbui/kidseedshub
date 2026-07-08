import { Plus } from "lucide-react"
import type { Dispatch, FormEvent, SetStateAction } from "react"
import { DialogFormShell } from "@/components/shared/dialog-shell"
import {
  expenseCategoryLabels,
  paymentMethodLabels,
  type ExpenseCategoryKey,
  type PaymentMethodKey
} from "@/lib/contracts/finance"
import type { ClassListItem } from "@/lib/contracts/courses"
import type { StudentListItem } from "@/lib/contracts/students"
import { FinanceInput } from "./finance-presentational"
import {
  formatMoney,
  getBillingMonthChoicesForYear,
  getBillingMonthInRange,
  getBillingPeriodForMonth,
  getCourseBillingMonthOptions,
  getMonthPart,
  type BillingMonthOption,
  type ExpenseFormState,
  type ReceiptBillingMode,
  type ReceiptFormState
} from "./finance-utils"

export type ReceiptEnrollmentOption = {
  course: StudentListItem["courses"][number]
  courseName: string
  enrollmentId: string
  parentName: string
  sessionsRemaining: number
  studentName: string
}

export function ReceiptDialog({
  activeReceiptBillingMonth,
  activeReceiptBillingYear,
  classes,
  defaultReceiptSessions,
  enrollmentOptions,
  isMonthlyBilling,
  isSubmitting,
  onClose,
  onSubmit,
  receiptBillingMonthChoices,
  receiptBillingMonthOptions,
  receiptBillingYearOptions,
  receiptExpectedAmount,
  receiptForm,
  setReceiptForm,
  suggestReceiptSessions,
  suggestedReceiptSessions
}: {
  activeReceiptBillingMonth: string
  activeReceiptBillingYear: string
  classes: ClassListItem[]
  defaultReceiptSessions: number
  enrollmentOptions: ReceiptEnrollmentOption[]
  isMonthlyBilling: boolean
  isSubmitting: boolean
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  receiptBillingMonthChoices: BillingMonthOption[]
  receiptBillingMonthOptions: BillingMonthOption[]
  receiptBillingYearOptions: string[]
  receiptExpectedAmount: number
  receiptForm: ReceiptFormState
  setReceiptForm: Dispatch<SetStateAction<ReceiptFormState>>
  suggestReceiptSessions: (enrollmentId: string, billingMonth: string, billingMode: ReceiptBillingMode) => string
  suggestedReceiptSessions: number | undefined
}) {
  return (
    <DialogFormShell
      title="Tạo phiếu thu"
      eyebrow="Receipt"
      description="Ghi nhận học phí theo khóa hoặc theo tháng và cộng số buổi vào khóa đã đăng ký."
      onClose={onClose}
      onSubmit={onSubmit}
      size="lg"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button type="button" className="neu-list-item rounded-2xl px-4 py-3 text-sm font-semibold text-stone-600 hover:text-brand-red" onClick={onClose}>
            Hủy
          </button>
          <button
            type="submit"
            disabled={isSubmitting || (isMonthlyBilling && !receiptBillingMonthOptions.length)}
            className="glass-button-primary inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            {isSubmitting ? "Đang lưu" : "Lưu phiếu thu"}
          </button>
        </div>
      }
    >
      <div className="grid gap-3 md:grid-cols-2">
        <label className="md:col-span-2">
          <span className="text-sm font-medium text-stone-600">Học viên / khóa học</span>
          <select
            className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 text-sm font-medium text-brand-ink outline-none"
            value={receiptForm.enrollmentId}
            onChange={(event) => {
              const enrollmentId = event.target.value
              const option = enrollmentOptions.find((item) => item.enrollmentId === enrollmentId)
              const billingMonth = getBillingMonthInRange(receiptForm.billingMonth, getCourseBillingMonthOptions(option?.course, classes))
              setReceiptForm((current) => ({
                ...current,
                enrollmentId,
                billingMonth,
                billableSessions: suggestReceiptSessions(enrollmentId, billingMonth, current.billingMode)
              }))
            }}
            required
          >
            <option value="">Chọn học viên / khóa học</option>
            {enrollmentOptions.map((option) => (
              <option key={option.enrollmentId} value={option.enrollmentId}>
                {option.studentName} - {option.courseName} - còn {option.sessionsRemaining} buổi
              </option>
            ))}
          </select>
        </label>
        <label className="md:col-span-2">
          <span className="text-sm font-medium text-stone-600">Cách thu học phí</span>
          <select
            className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 text-sm font-medium text-brand-ink outline-none"
            value={receiptForm.billingMode}
            onChange={(event) => {
              const billingMode = event.target.value as ReceiptBillingMode
              const billingMonth = getBillingMonthInRange(receiptForm.billingMonth, receiptBillingMonthOptions)
              setReceiptForm((current) => ({
                ...current,
                billingMode,
                billingMonth,
                billableSessions: suggestReceiptSessions(current.enrollmentId, billingMonth, billingMode)
              }))
            }}
          >
            <option value="COURSE">Thu theo khóa / số buổi còn lại</option>
            <option value="MONTHLY">Thu theo tháng</option>
          </select>
        </label>
        {isMonthlyBilling ? (
          receiptBillingMonthOptions.length ? (
            <div className="grid gap-3 md:col-span-2 md:grid-cols-2">
              <label>
                <span className="text-sm font-medium text-stone-600">Tháng kỳ thu</span>
                <select
                  className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 text-sm font-medium text-brand-ink outline-none"
                  value={getMonthPart(activeReceiptBillingMonth)}
                  onChange={(event) => {
                    const billingMonth = `${activeReceiptBillingYear}-${event.target.value}`
                    setReceiptForm((current) => ({
                      ...current,
                      billingMonth,
                      billableSessions: suggestReceiptSessions(current.enrollmentId, billingMonth, current.billingMode)
                    }))
                  }}
                >
                  {receiptBillingMonthChoices.map((choice) => (
                    <option key={choice.value} value={choice.month}>{choice.label}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="text-sm font-medium text-stone-600">Năm kỳ thu</span>
                <select
                  className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 text-sm font-medium text-brand-ink outline-none"
                  value={activeReceiptBillingYear}
                  onChange={(event) => {
                    const yearMonthOptions = getBillingMonthChoicesForYear(receiptBillingMonthOptions, event.target.value)
                    const month = yearMonthOptions.some((option) => option.month === getMonthPart(activeReceiptBillingMonth))
                      ? getMonthPart(activeReceiptBillingMonth)
                      : (yearMonthOptions[0]?.month ?? "01")
                    const billingMonth = `${event.target.value}-${month}`
                    setReceiptForm((current) => ({
                      ...current,
                      billingMonth,
                      billableSessions: suggestReceiptSessions(current.enrollmentId, billingMonth, current.billingMode)
                    }))
                  }}
                >
                  {receiptBillingYearOptions.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </label>
            </div>
          ) : (
            <p className="md:col-span-2 rounded-2xl border border-brand-red/10 bg-white/45 px-4 py-3 text-sm font-semibold text-stone-500">
              Khóa học này chưa có lịch lớp hoặc ngày học hợp lệ để chọn kỳ thu theo tháng.
            </p>
          )
        ) : null}
        <FinanceInput
          label="Số buổi tính phí"
          type="number"
          min="0"
          value={receiptForm.billableSessions}
          onChange={(value) => setReceiptForm((current) => ({ ...current, billableSessions: value }))}
          required
        />
        <div className="md:col-span-2 rounded-2xl border border-brand-red/10 bg-white/45 p-4 text-sm text-stone-600">
          <p className="font-semibold text-brand-ink">{isMonthlyBilling ? getBillingPeriodForMonth(activeReceiptBillingMonth).label : "Thu theo khóa / số buổi còn lại"}</p>
          <p className="mt-1">
            {isMonthlyBilling
              ? (suggestedReceiptSessions === undefined
                ? "Chưa có lịch lớp để tự gợi ý, backend sẽ kiểm tra lại khi lưu."
                : `Gợi ý từ lịch lớp: ${suggestedReceiptSessions} buổi.`)
              : `Gợi ý theo số buổi còn lại: ${defaultReceiptSessions} buổi.`}
          </p>
          <p className="mt-1">Dự kiến: {formatMoney(String(Math.round(receiptExpectedAmount)))}</p>
        </div>
        <label>
          <span className="text-sm font-medium text-stone-600">Phương thức</span>
          <select
            className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 text-sm font-medium text-brand-ink outline-none"
            value={receiptForm.method}
            onChange={(event) => setReceiptForm((current) => ({ ...current, method: event.target.value as PaymentMethodKey }))}
          >
            {Object.entries(paymentMethodLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <FinanceInput
          label="Ghi chú"
          value={receiptForm.note}
          onChange={(value) => setReceiptForm((current) => ({ ...current, note: value }))}
        />
      </div>
    </DialogFormShell>
  )
}

export function ExpenseDialog({
  expenseForm,
  isSubmitting,
  onClose,
  onSubmit,
  setExpenseForm
}: {
  expenseForm: ExpenseFormState
  isSubmitting: boolean
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  setExpenseForm: Dispatch<SetStateAction<ExpenseFormState>>
}) {
  return (
    <DialogFormShell
      title="Tạo phiếu chi"
      eyebrow="Expense"
      description="Ghi nhận chi phí vận hành theo danh mục."
      onClose={onClose}
      onSubmit={onSubmit}
      size="lg"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button type="button" className="neu-list-item rounded-2xl px-4 py-3 text-sm font-semibold text-stone-600 hover:text-brand-red" onClick={onClose}>
            Hủy
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="glass-button-primary inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            {isSubmitting ? "Đang lưu" : "Lưu phiếu chi"}
          </button>
        </div>
      }
    >
      <div className="grid gap-3 md:grid-cols-2">
        <label>
          <span className="text-sm font-medium text-stone-600">Danh mục</span>
          <select
            className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 text-sm font-medium text-brand-ink outline-none"
            value={expenseForm.category}
            onChange={(event) => setExpenseForm((current) => ({ ...current, category: event.target.value as ExpenseCategoryKey }))}
          >
            {Object.entries(expenseCategoryLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <FinanceInput
          label="Ngày chi"
          type="date"
          value={expenseForm.date}
          onChange={(value) => setExpenseForm((current) => ({ ...current, date: value }))}
          required
        />
        <FinanceInput
          label="Số tiền"
          type="number"
          min="1"
          value={expenseForm.amount}
          onChange={(value) => setExpenseForm((current) => ({ ...current, amount: value }))}
          required
        />
        <FinanceInput
          label="Invoice URL"
          type="url"
          value={expenseForm.invoiceUrl}
          onChange={(value) => setExpenseForm((current) => ({ ...current, invoiceUrl: value }))}
        />
        <label className="md:col-span-2">
          <span className="text-sm font-medium text-stone-600">Mô tả</span>
          <textarea
            className="neu-pressed mt-2 min-h-24 w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none placeholder:text-stone-400"
            value={expenseForm.description}
            onChange={(event) => setExpenseForm((current) => ({ ...current, description: event.target.value }))}
            required
          />
        </label>
      </div>
    </DialogFormShell>
  )
}
