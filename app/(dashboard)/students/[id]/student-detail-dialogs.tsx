import { CreditCard } from "lucide-react"
import { DialogShell } from "@/components/shared/dialog-shell"
import { paymentMethodLabels, type PaymentMethodKey } from "@/lib/contracts/finance"
import { getBillingPeriodForMonth, type LearningDetailTarget, type ReceiptDraftLine, type ReceiptExtraDraftLine } from "./student-detail-utils"
import { InfoPill, LearningMetric } from "./student-detail-presentational"

type FormatDate = (value: string) => string
type FormatCurrency = (value: number) => string
type FormatWeekday = (weekday: number) => string

type ReceiptLineSummary = {
  line: ReceiptDraftLine
  course?: { courseName: string }
  billableSessions: number
  amount: number
}

type ReceiptExtraLineSummary = {
  line: ReceiptExtraDraftLine
  quantity: number
  unitPrice: number
  amount: number
}

export function ConfirmDialog({
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

export function ReceiptPaymentConfirmDialog({
  activeReceiptBillingMonth,
  actualReceiptAmount,
  actualReceiptPaymentAmount,
  coursePayableAmount,
  extraPayableAmount,
  formatCurrency,
  isOpen,
  isReceiptMonthlyBilling,
  isSubmittingReceipt,
  onClose,
  onConfirm,
  receiptExtraLineSummaries,
  receiptLineSummaries,
  receiptMethod,
  receiptNote,
  receiptValidationErrors,
  walletBalance,
  walletCreditAmount
}: {
  activeReceiptBillingMonth: string
  actualReceiptAmount: number
  actualReceiptPaymentAmount: number
  coursePayableAmount: number
  extraPayableAmount: number
  formatCurrency: FormatCurrency
  isOpen: boolean
  isReceiptMonthlyBilling: boolean
  isSubmittingReceipt: boolean
  onClose: () => void
  onConfirm: () => void
  receiptExtraLineSummaries: ReceiptExtraLineSummary[]
  receiptLineSummaries: ReceiptLineSummary[]
  receiptMethod: PaymentMethodKey
  receiptNote: string
  receiptValidationErrors: string[]
  walletBalance: number
  walletCreditAmount: number
}) {
  if (!isOpen) return null

  const billingPeriod = getBillingPeriodForMonth(activeReceiptBillingMonth)

  return (
    <DialogShell
      eyebrow="Preview phiếu thu"
      title="Xác nhận đóng tiền"
      description="Kiểm tra học phí khóa, khoản thu riêng, credit và thực thu trước khi lưu phiếu."
      onClose={onClose}
      closeLabel="Đóng xác nhận đóng tiền"
      size="lg"
      bodyClassName="p-0"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="glass-button-secondary px-4 py-3 text-sm font-semibold">Hủy</button>
          <button
            type="button"
            disabled={isSubmittingReceipt || receiptValidationErrors.length > 0}
            onClick={onConfirm}
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
          <InfoPill label="Cách thu" value={isReceiptMonthlyBilling ? billingPeriod.label.replace("Học phí ", "") : "Theo khóa"} />
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
                  <span>{summary.course?.courseName ?? "Khóa đã đăng ký"} · {summary.billableSessions} buổi{isReceiptMonthlyBilling ? ` · ${billingPeriod.label}` : ""}</span>
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
  )
}

export function LearningDetailDialog({
  target,
  onClose,
  formatDate,
  formatCurrency,
  formatWeekday
}: {
  target: LearningDetailTarget | null
  onClose: () => void
  formatDate: FormatDate
  formatCurrency: FormatCurrency
  formatWeekday: FormatWeekday
}) {
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
