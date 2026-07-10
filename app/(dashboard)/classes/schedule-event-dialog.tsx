"use client"

import { Plus } from "lucide-react"
import type { Dispatch, FormEvent, SetStateAction } from "react"
import { DialogFormShell } from "@/components/shared/dialog-shell"

type EventFormState = {
  title: string
  date: string
  type: "HOLIDAY" | "EVENT"
  affectsScheduling: boolean
  note: string
}

type ScheduleEventDialogProps = {
  eventForm: EventFormState
  setEventForm: Dispatch<SetStateAction<EventFormState>>
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>
  canManageSchedule: boolean
  isSaving: string | null
  panelClassName: string
  bodyClassName: string
}

export function ScheduleEventDialog({
  eventForm,
  setEventForm,
  onClose,
  onSubmit,
  canManageSchedule,
  isSaving,
  panelClassName,
  bodyClassName
}: ScheduleEventDialogProps) {
  return (
    <DialogFormShell
      eyebrow="Lịch nghỉ"
      title="Thêm lịch nghỉ / sự kiện"
      description="Ngày nghỉ có bật tự động chuyển lịch sẽ chuyển các buổi học chưa điểm danh sang ngày học kế tiếp của lớp."
      onClose={onClose}
      closeLabel="Đóng form lịch nghỉ"
      size="lg"
      panelClassName={panelClassName}
      bodyClassName={bodyClassName}
      onSubmit={onSubmit}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            className="neu-list-item inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold text-stone-600 hover:text-brand-red"
            onClick={onClose}
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={!canManageSchedule || isSaving === "schedule-event"}
            className="glass-button-primary inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            {isSaving === "schedule-event" ? "Đang lưu" : "Thêm lịch nghỉ"}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-3xl border border-brand-red/15 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500 md:col-span-2">
              Tên ngày nghỉ / sự kiện
              <input
                className="mt-2 w-full rounded-2xl border border-brand-red/10 bg-[#fffaf7] px-3 py-2 text-sm normal-case tracking-normal text-brand-ink outline-none"
                value={eventForm.title}
                onChange={(event) => setEventForm((current) => ({ ...current, title: event.target.value }))}
                required
              />
            </label>
            <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500">
              Ngày
              <input
                className="mt-2 w-full rounded-2xl border border-brand-red/10 bg-[#fffaf7] px-3 py-2 text-sm normal-case tracking-normal text-brand-ink outline-none"
                type="date"
                value={eventForm.date}
                onChange={(event) => setEventForm((current) => ({ ...current, date: event.target.value }))}
                required
              />
            </label>
            <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500">
              Loại
              <select
                className="mt-2 w-full rounded-2xl border border-brand-red/10 bg-[#fffaf7] px-3 py-2 text-sm normal-case tracking-normal text-brand-ink outline-none"
                value={eventForm.type}
                onChange={(event) => setEventForm((current) => ({ ...current, type: event.target.value as EventFormState["type"] }))}
              >
                <option value="HOLIDAY">Nghỉ lễ</option>
                <option value="EVENT">Sự kiện</option>
              </select>
            </label>
            <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500 md:col-span-2">
              Ghi chú
              <input
                className="mt-2 w-full rounded-2xl border border-brand-red/10 bg-[#fffaf7] px-3 py-2 text-sm normal-case tracking-normal text-brand-ink outline-none"
                value={eventForm.note}
                onChange={(event) => setEventForm((current) => ({ ...current, note: event.target.value }))}
              />
            </label>
          </div>
        </div>
        <label className="flex cursor-pointer items-start gap-3 rounded-3xl border border-brand-red/15 bg-white p-4 shadow-sm">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-brand-red"
            checked={eventForm.affectsScheduling}
            onChange={(event) => setEventForm((current) => ({ ...current, affectsScheduling: event.target.checked }))}
          />
          <span>
            <span className="block text-sm font-semibold text-brand-ink">Tự động chuyển lịch học</span>
            <span className="mt-1 block text-xs leading-5 text-stone-500">
              Chỉ các buổi chưa điểm danh mới được chuyển. Hệ thống chuyển lịch theo chuỗi ngày học kế tiếp của lớp để tránh trùng lịch.
            </span>
          </span>
        </label>
      </div>
    </DialogFormShell>
  )
}
