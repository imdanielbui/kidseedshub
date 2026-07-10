"use client"

import { StickyNote, Trash2, UploadCloud } from "lucide-react"
import type { ChangeEvent, Dispatch, SetStateAction } from "react"
import { DialogShell } from "@/components/shared/dialog-shell"
import { subjectLabels } from "@/lib/contracts/assessment"
import { classPhotoUploadAcceptedMimeTypes, type ClassPhotoListItem } from "@/lib/contracts/classes"
import type { ClassCalendarSessionItem, ClassListItem, ClassStudentItem } from "@/lib/contracts/courses"
import type { StudentListItem } from "@/lib/contracts/students"
import { formatFileSize } from "./class-schedule-utils"

type SessionDetailDialogProps = {
  selectedSession: ClassCalendarSessionItem
  selectedClass: ClassListItem | undefined
  selectedClassStudents: ClassStudentItem[]
  availableStudentsForSelectedClass: StudentListItem[]
  selectedSessionPhotos: ClassPhotoListItem[]
  sessionPhotoFiles: File[]
  sessionPhotoPreviewUrls: string[]
  sessionPhotoUrl: string
  sessionPhotoCaption: string
  photoCaptionDrafts: Record<string, string>
  canManageSchedule: boolean
  isSaving: string | null
  photoSavingId: string | null
  panelClassName: string
  bodyClassName: string
  onClose: () => void
  patchSession: (sessionId: string, body: Partial<Pick<ClassCalendarSessionItem, "date" | "status" | "startTime" | "endTime" | "room">>) => Promise<void>
  selectSessionPhotoFiles: (event: ChangeEvent<HTMLInputElement>) => void
  setSessionPhotoCaption: Dispatch<SetStateAction<string>>
  setSessionPhotoUrl: Dispatch<SetStateAction<string>>
  submitSessionAlbumPhotos: () => Promise<void>
  clearSessionPhotoFiles: () => void
  setPhotoCaptionDrafts: Dispatch<SetStateAction<Record<string, string>>>
  patchClassPhoto: (
    photoId: string,
    body: { caption?: string | null; isFeatured?: boolean; isPublished?: boolean; markSent?: boolean }
  ) => Promise<void>
  deleteClassPhoto: (photo: ClassPhotoListItem) => Promise<void>
  updateClassStudents: (classId: string, studentIds: string[]) => Promise<void>
}

export function SessionDetailDialog({
  selectedSession,
  selectedClass,
  selectedClassStudents,
  availableStudentsForSelectedClass,
  selectedSessionPhotos,
  sessionPhotoFiles,
  sessionPhotoPreviewUrls,
  sessionPhotoUrl,
  sessionPhotoCaption,
  photoCaptionDrafts,
  canManageSchedule,
  isSaving,
  photoSavingId,
  panelClassName,
  bodyClassName,
  onClose,
  patchSession,
  selectSessionPhotoFiles,
  setSessionPhotoCaption,
  setSessionPhotoUrl,
  submitSessionAlbumPhotos,
  clearSessionPhotoFiles,
  setPhotoCaptionDrafts,
  patchClassPhoto,
  deleteClassPhoto,
  updateClassStudents
}: SessionDetailDialogProps) {
  return (
    <DialogShell
      eyebrow="Thông tin buổi học"
      title={selectedSession.className}
      description={`${selectedSession.courseName} - ${subjectLabels[selectedSession.subject]} - GV ${selectedSession.teacherName}`}
      onClose={onClose}
      closeLabel="Đóng thông tin buổi học"
      size="lg"
      panelClassName={panelClassName}
      bodyClassName={bodyClassName}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-brand-red/10 p-4">
          <p className="text-sm text-stone-500">Thời gian</p>
          <p className="mt-2 text-lg font-semibold text-brand-ink">
            {selectedSession.date.slice(0, 10)} - {selectedSession.startTime} đến {selectedSession.endTime}
          </p>
          <p className="mt-2 text-sm text-stone-500">Phòng: {selectedSession.room || "Chưa chọn"}</p>
          <p className="mt-1 text-sm text-stone-500">Học viên: {selectedSession.studentCount}</p>
        </div>
        <div className="rounded-2xl border border-brand-red/10 p-4">
          <label className="block text-sm font-semibold text-stone-700">
            Trạng thái buổi học
            <select
              className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none"
              value={selectedSession.status}
              disabled={!canManageSchedule || isSaving === selectedSession.id}
              onChange={(event) => void patchSession(selectedSession.id, { status: event.target.value as ClassCalendarSessionItem["status"] })}
            >
              <option value="SCHEDULED">Đã lên lịch</option>
              <option value="COMPLETED">Đã học</option>
              <option value="CANCELED">Nghỉ / hủy buổi</option>
            </select>
          </label>
        </div>
      </div>

      <section className="content-border mt-4 rounded-2xl p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-red">Album buổi học</p>
            <h3 className="mt-1 text-base font-semibold text-brand-ink">Ảnh lớp nội bộ</h3>
            <p className="mt-1 text-xs text-stone-500">
              Quản lý ảnh theo buổi học. Ảnh riêng của bé sẽ được duyệt gửi trong profile học viên.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold text-stone-600">
            <span className="rounded-2xl border border-brand-red/10 px-3 py-2">{selectedSessionPhotos.length} ảnh</span>
            <span className="rounded-2xl border border-brand-red/10 px-3 py-2">
              {selectedSessionPhotos.filter((photo) => !photo.studentId).length} ảnh chung
            </span>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px_auto]">
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-stone-600">
              Chọn ảnh lớp
              <input
                className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-3 py-2 text-sm text-brand-ink outline-none file:mr-3 file:rounded-xl file:border-0 file:bg-brand-red file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white"
                type="file"
                multiple
                accept={classPhotoUploadAcceptedMimeTypes.join(",")}
                onChange={selectSessionPhotoFiles}
              />
            </label>
            {sessionPhotoPreviewUrls.length ? (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {sessionPhotoPreviewUrls.map((url, index) => (
                  <div key={url} className="rounded-2xl border border-brand-red/10 bg-white/45 p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Ảnh lớp ${index + 1}`} className="h-24 w-full rounded-xl object-cover" />
                    <p className="mt-2 truncate text-xs font-semibold text-brand-ink">{sessionPhotoFiles[index]?.name}</p>
                    <p className="mt-1 text-xs text-stone-500">{formatFileSize(sessionPhotoFiles[index]?.size ?? 0)}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-stone-600">
              Ghi chú ảnh
              <textarea
                className="neu-pressed mt-2 min-h-20 w-full resize-none rounded-2xl bg-transparent px-3 py-2 text-sm text-brand-ink outline-none placeholder:text-stone-400"
                value={sessionPhotoCaption}
                onChange={(event) => setSessionPhotoCaption(event.target.value)}
                placeholder="Hoạt động, sản phẩm, khoảnh khắc nổi bật..."
              />
            </label>
            <label className="block text-xs font-semibold text-stone-600">
              URL ảnh dự phòng
              <input
                className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-3 py-2 text-sm text-brand-ink outline-none placeholder:text-stone-400 disabled:opacity-60"
                value={sessionPhotoUrl}
                disabled={sessionPhotoFiles.length > 0}
                onChange={(event) => setSessionPhotoUrl(event.target.value)}
                placeholder="https://..."
              />
            </label>
          </div>
          <div className="flex flex-col gap-2 lg:items-end lg:justify-end">
            <button
              type="button"
              disabled={photoSavingId === "session-album"}
              onClick={() => void submitSessionAlbumPhotos()}
              className="glass-button-primary inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold disabled:opacity-50"
            >
              <UploadCloud className="h-4 w-4" />
              {photoSavingId === "session-album" ? "Đang lưu" : "Lưu album"}
            </button>
            {sessionPhotoFiles.length ? (
              <button
                type="button"
                className="rounded-2xl border border-brand-red/15 px-4 py-2 text-xs font-semibold text-brand-red"
                onClick={clearSessionPhotoFiles}
              >
                Gỡ ảnh chọn
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {selectedSessionPhotos.length ? selectedSessionPhotos.map((photo) => (
            <article key={photo.id} className="overflow-hidden rounded-2xl border border-brand-red/10 bg-white/45">
              <a href={photo.url} target="_blank" rel="noreferrer" className="block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt={photo.caption || "Ảnh lớp học"} className="h-40 w-full object-cover" />
              </a>
              <div className="space-y-3 p-3">
                <div className="flex flex-wrap gap-2 text-xs font-semibold">
                  <span className={`rounded-full border px-2 py-1 ${photo.isPublished ? "border-emerald-200 text-emerald-700" : "border-brand-red/15 text-stone-500"}`}>
                    {photo.isPublished ? "Phụ huynh thấy" : "Nháp"}
                  </span>
                  {photo.sentToParentAt ? <span className="rounded-full border border-brand-red/10 px-2 py-1 text-stone-500">Đã gửi</span> : null}
                  {photo.studentName ? <span className="rounded-full border border-brand-red/10 px-2 py-1 text-stone-500">{photo.studentName}</span> : null}
                </div>
                <textarea
                  className="neu-pressed min-h-16 w-full resize-none rounded-2xl bg-transparent px-3 py-2 text-sm text-brand-ink outline-none placeholder:text-stone-400"
                  value={photoCaptionDrafts[photo.id] ?? ""}
                  onChange={(event) => setPhotoCaptionDrafts((current) => ({ ...current, [photo.id]: event.target.value }))}
                  placeholder="Ghi chú gửi phụ huynh..."
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={photoSavingId === photo.id}
                    className="neu-list-item inline-flex items-center gap-1 rounded-2xl px-3 py-2 text-xs font-semibold text-stone-600 hover:text-brand-red disabled:opacity-50"
                    onClick={() => void patchClassPhoto(photo.id, { caption: photoCaptionDrafts[photo.id] ?? "" })}
                  >
                    <StickyNote className="h-3.5 w-3.5" />
                    Lưu
                  </button>
                  <button
                    type="button"
                    disabled={photoSavingId === photo.id}
                    className="neu-list-item inline-flex items-center gap-1 rounded-2xl px-3 py-2 text-xs font-semibold text-brand-red disabled:opacity-50"
                    onClick={() => void deleteClassPhoto(photo)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Xóa
                  </button>
                </div>
              </div>
            </article>
          )) : (
            <p className="rounded-2xl border border-brand-red/10 p-4 text-sm text-stone-500 md:col-span-2">
              Chưa có ảnh cho buổi học này.
            </p>
          )}
        </div>
      </section>

      <div className="mt-4 rounded-2xl border border-brand-red/10 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-brand-ink">Học sinh trong lớp</p>
            <p className="mt-1 text-xs text-stone-500">Danh sách này áp dụng cho tất cả buổi học được sinh từ lớp.</p>
          </div>
          <select
            className="neu-pressed rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none disabled:opacity-50"
            disabled={!canManageSchedule || !selectedClass}
            defaultValue=""
            onChange={(event) => {
              if (!selectedClass || !event.target.value) return
              void updateClassStudents(selectedClass.id, [
                ...selectedClassStudents.map((student) => student.studentId),
                event.target.value
              ])
              event.target.value = ""
            }}
          >
            <option value="">Thêm học sinh</option>
            {availableStudentsForSelectedClass
              .filter((student) => !selectedClassStudents.some((item) => item.studentId === student.id))
              .map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name} - {student.parentName}
                </option>
              ))}
          </select>
        </div>
        <div className="mt-3 space-y-2">
          {selectedClassStudents.length ? (
            selectedClassStudents.map((student) => (
              <div key={student.id} className="neu-list-item flex items-center justify-between gap-3 rounded-2xl px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-brand-ink">{student.studentName}</p>
                  <p className="truncate text-xs text-stone-500">
                    {student.parentName} - {student.parentPhone}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!canManageSchedule || isSaving === selectedClass?.id}
                  className="rounded-xl border border-brand-red/15 px-3 py-2 text-xs font-semibold text-brand-red disabled:opacity-50"
                  onClick={() =>
                    selectedClass
                      ? void updateClassStudents(
                          selectedClass.id,
                          selectedClassStudents.filter((item) => item.studentId !== student.studentId).map((item) => item.studentId)
                        )
                      : undefined
                  }
                >
                  Xóa
                </button>
              </div>
            ))
          ) : (
            <p className="rounded-2xl border border-brand-red/10 p-3 text-sm text-stone-500">Lớp này chưa có học sinh.</p>
          )}
        </div>
      </div>
    </DialogShell>
  )
}
