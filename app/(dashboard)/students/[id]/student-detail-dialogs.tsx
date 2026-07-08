import { DialogShell } from "@/components/shared/dialog-shell"
import type { LearningDetailTarget } from "./student-detail-utils"
import { LearningMetric } from "./student-detail-presentational"

type FormatDate = (value: string) => string
type FormatCurrency = (value: number) => string
type FormatWeekday = (weekday: number) => string

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
