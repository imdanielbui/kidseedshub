"use client"

import { Repeat2, Save } from "lucide-react"
import type { FormEvent } from "react"
import { DialogFormShell } from "@/components/shared/dialog-shell"
import type { ClassListItem, CourseListItem } from "@/lib/contracts/courses"
import type { StudentDetail } from "@/lib/contracts/students"
import type { EnrollmentEditDraft, EnrollmentTransferDraft } from "./student-detail-utils"
import { DetailInput, InfoPill } from "./student-detail-presentational"

type JoinPreview = {
  joinSessionNumber: number
  sessionsFromJoin: number
  warning?: string
}

type StudentEnrollmentDialogsProps = {
  transferDraft: EnrollmentTransferDraft | null
  transferSourceCourse?: StudentDetail["courses"][number]
  transferRemainingSessions: number
  transferCreditPreview: number
  transferTargetPrice: number
  transferTopUpPreview: number
  transferTargetCourse?: CourseListItem
  transferClassOptions: ClassListItem[]
  activeCourseOptions: CourseListItem[]
  isCourseTransfer: boolean
  isSubmittingTransfer: boolean
  editingEnrollment: EnrollmentEditDraft | null
  editingCourse?: StudentDetail["courses"][number]
  editingClassOptions: ClassListItem[]
  editingJoinPreview: JoinPreview
  isUpdatingEnrollment: boolean
  isDeletingEnrollment: boolean
  formatCurrency: (value: number) => string
  toNonNegativeIntegerInput: (value: string) => string
  setTransferDraft: (value: EnrollmentTransferDraft | null) => void
  setEditingEnrollment: (value: EnrollmentEditDraft | null) => void
  setIsConfirmingEnrollmentDelete: (value: boolean) => void
  submitTransfer: (event: FormEvent<HTMLFormElement>) => void
  submitEnrollmentEdit: (event: FormEvent<HTMLFormElement>) => void
}

export function StudentEnrollmentDialogs({
  transferDraft,
  transferSourceCourse,
  transferRemainingSessions,
  transferCreditPreview,
  transferTargetPrice,
  transferTopUpPreview,
  transferTargetCourse,
  transferClassOptions,
  activeCourseOptions,
  isCourseTransfer,
  isSubmittingTransfer,
  editingEnrollment,
  editingCourse,
  editingClassOptions,
  editingJoinPreview,
  isUpdatingEnrollment,
  isDeletingEnrollment,
  formatCurrency,
  toNonNegativeIntegerInput,
  setTransferDraft,
  setEditingEnrollment,
  setIsConfirmingEnrollmentDelete,
  submitTransfer,
  submitEnrollmentEdit
}: StudentEnrollmentDialogsProps) {
  return (
    <>
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
              <p className="rounded-2xl border border-brand-red/10 bg-white/45 px-3 py-2 text-xs font-semibold text-stone-500 md:col-span-2">{editingJoinPreview.warning}</p>
            ) : null}
            <label className="flex items-center gap-2 rounded-2xl border border-brand-red/10 px-3 py-3 text-sm font-semibold text-stone-600 md:col-span-2">
              <input type="checkbox" checked={editingEnrollment.isActive} onChange={(event) => setEditingEnrollment({ ...editingEnrollment, isActive: event.target.checked })} />
              Khóa đang hoạt động
            </label>
          </div>
        </DialogFormShell>
      ) : null}
    </>
  )
}
