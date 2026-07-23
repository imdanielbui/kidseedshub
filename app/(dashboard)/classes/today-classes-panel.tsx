"use client"

import { Check, CircleSlash, Clock, ImagePlus, StickyNote, Trash2, UploadCloud, UserRound, X } from "lucide-react"
import type { ChangeEvent, Dispatch, SetStateAction } from "react"
import { subjectLabels } from "@/lib/contracts/assessment"
import {
  attendanceStatusLabels,
  classPhotoUploadAcceptedMimeTypes,
  type AttendanceStatusKey,
  type ClassPhotoListItem,
  type TodayClassItem,
  type TodayClassStudent
} from "@/lib/contracts/classes"
import { TodayClassTimeline } from "./today-class-timeline"

const attendanceActions: Array<{
  status: AttendanceStatusKey
  label: string
  icon: typeof Check
}> = [
  { status: "PRESENT", label: "Có mặt", icon: Check },
  { status: "ABSENT_EXCUSED", label: "Nghỉ", icon: CircleSlash },
  { status: "ABSENT_NO_EXCUSE", label: "Vắng", icon: X }
]

type AttendanceSummary = {
  total: number
  marked: number
  present: number
  absent: number
}

type TodayClassesPanelProps = {
  isLoading: boolean
  classes: TodayClassItem[]
  selectedClass: TodayClassItem | undefined
  attendanceSummary: AttendanceSummary
  selectedClassPhotos: ClassPhotoListItem[]
  expandedStudentId: string | null
  isSaving: string | null
  photoSavingId: string | null
  classPhotoFiles: File[]
  classPhotoPreviewUrls: string[]
  classPhotoUrl: string
  classPhotoCaption: string
  studentPhotoFilesById: Record<string, File[]>
  studentPhotoPreviewUrlsById: Record<string, string[]>
  studentPhotoCaptionsById: Record<string, string>
  noteDrafts: Record<string, string>
  photoCaptionDrafts: Record<string, string>
  setSelectedClassId: Dispatch<SetStateAction<string>>
  setExpandedStudentId: Dispatch<SetStateAction<string | null>>
  selectClassPhotoFiles: (event: ChangeEvent<HTMLInputElement>) => void
  setClassPhotoCaption: Dispatch<SetStateAction<string>>
  setClassPhotoUrl: Dispatch<SetStateAction<string>>
  submitClassAlbumPhotos: (classId: string) => Promise<void>
  clearClassPhotoFiles: () => void
  setPhotoCaptionDrafts: Dispatch<SetStateAction<Record<string, string>>>
  patchClassPhoto: (
    photoId: string,
    body: { caption?: string | null; isFeatured?: boolean; isPublished?: boolean; markSent?: boolean }
  ) => Promise<void>
  deleteClassPhoto: (photo: ClassPhotoListItem) => Promise<void>
  markAttendance: (classId: string, student: TodayClassStudent, status: AttendanceStatusKey) => Promise<void>
  setNoteDrafts: Dispatch<SetStateAction<Record<string, string>>>
  selectStudentPhotoFiles: (studentId: string, event: ChangeEvent<HTMLInputElement>) => void
  setStudentPhotoCaptionsById: Dispatch<SetStateAction<Record<string, string>>>
  submitStudentPhotos: (classId: string, student: TodayClassStudent) => Promise<void>
  clearStudentPhotoFiles: (studentId: string) => void
}

export function TodayClassesPanel({
  isLoading,
  classes,
  selectedClass,
  attendanceSummary,
  selectedClassPhotos,
  expandedStudentId,
  isSaving,
  photoSavingId,
  classPhotoFiles,
  classPhotoPreviewUrls,
  classPhotoUrl,
  classPhotoCaption,
  studentPhotoFilesById,
  studentPhotoPreviewUrlsById,
  studentPhotoCaptionsById,
  noteDrafts,
  photoCaptionDrafts,
  setSelectedClassId,
  setExpandedStudentId,
  selectClassPhotoFiles,
  setClassPhotoCaption,
  setClassPhotoUrl,
  submitClassAlbumPhotos,
  clearClassPhotoFiles,
  setPhotoCaptionDrafts,
  patchClassPhoto,
  deleteClassPhoto,
  markAttendance,
  setNoteDrafts,
  selectStudentPhotoFiles,
  setStudentPhotoCaptionsById,
  submitStudentPhotos,
  clearStudentPhotoFiles
}: TodayClassesPanelProps) {
  if (isLoading) {
    return <p className="neu-card rounded-3xl p-6 text-sm text-stone-500">Đang tải lớp hôm nay...</p>
  }

  if (!classes.length || !selectedClass) {
    return <p className="neu-card rounded-3xl p-6 text-sm text-stone-500">Hôm nay chưa có lớp active theo lịch.</p>
  }

  return (
    <section className="neu-card overflow-hidden rounded-3xl">
      <div className="grid gap-0 xl:grid-cols-[320px_1fr]">
        <aside className="border-b border-brand-red/10 p-4 xl:border-b-0 xl:border-r">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-brand-red">Hôm nay</p>
              <h2 className="mt-1 text-lg font-semibold text-brand-ink">{classes.length} lớp</h2>
            </div>
            <span className="rounded-2xl border border-brand-red/10 px-3 py-2 text-xs font-semibold text-stone-600">
              {attendanceSummary.marked}/{attendanceSummary.total}
            </span>
          </div>
          <TodayClassTimeline
            classes={classes}
            selectedClassId={selectedClass.id}
            setSelectedClassId={setSelectedClassId}
            setExpandedStudentId={setExpandedStudentId}
          />
        </aside>

        <div className="min-w-0 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <h2 className="truncate text-xl font-semibold text-brand-ink">{selectedClass.name}</h2>
              <p className="mt-1 truncate text-sm text-stone-500">
                {selectedClass.courseName} - {subjectLabels[selectedClass.subject]} - GV {selectedClass.teacherName}
              </p>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center text-xs font-semibold text-stone-600">
              <span className="rounded-2xl border border-brand-red/10 px-3 py-2">Tổng {attendanceSummary.total}</span>
              <span className="rounded-2xl border border-brand-red/10 px-3 py-2">Đã {attendanceSummary.marked}</span>
              <span className="rounded-2xl border border-brand-red/10 px-3 py-2">Có {attendanceSummary.present}</span>
              <span className="rounded-2xl border border-brand-red/10 px-3 py-2">Vắng {attendanceSummary.absent}</span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-stone-600">
            <span className="inline-flex items-center gap-2 rounded-2xl border border-brand-red/10 px-3 py-2">
              <Clock className="h-4 w-4 text-brand-red" />
              {selectedClass.startTime}-{selectedClass.endTime}
            </span>
            {selectedClass.room ? <span className="rounded-2xl border border-brand-red/10 px-3 py-2">{selectedClass.room}</span> : null}
            <span className="inline-flex items-center gap-2 rounded-2xl border border-brand-red/10 px-3 py-2">
              <ImagePlus className="h-4 w-4 text-brand-red" />
              {selectedClass.photoCount} ảnh lớp
            </span>
          </div>

          <section className="content-border mt-4 rounded-2xl p-3">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-brand-red">Album buổi học</p>
                <h3 className="mt-1 text-base font-semibold text-brand-ink">Ảnh lớp nội bộ</h3>
                <p className="mt-1 text-xs text-stone-500">Ảnh riêng của bé upload ở từng học viên và duyệt gửi trong profile.</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-semibold text-stone-600">
                <span className="rounded-2xl border border-brand-red/10 px-3 py-2">{selectedClassPhotos.length} ảnh</span>
                <span className="rounded-2xl border border-brand-red/10 px-3 py-2">
                  {selectedClassPhotos.filter((photo) => !photo.studentId).length} ảnh chung
                </span>
              </div>
            </div>

            <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_260px_auto]">
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-stone-600">
                  Chọn ảnh lớp
                  <input
                    className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-3 py-2 text-sm text-brand-ink outline-none file:mr-3 file:rounded-xl file:border-0 file:bg-brand-red file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white"
                    type="file"
                    multiple
                    accept={classPhotoUploadAcceptedMimeTypes.join(",")}
                    disabled={!selectedClass.sessionId}
                    onChange={selectClassPhotoFiles}
                  />
                </label>
                {classPhotoPreviewUrls.length ? (
                  <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-4">
                    {classPhotoPreviewUrls.map((url, index) => (
                      <div key={url} className="rounded-2xl border border-brand-red/10 bg-white/45 p-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={`Ảnh lớp ${index + 1}`} className="h-24 w-full rounded-xl object-cover" />
                        <p className="mt-2 truncate text-xs font-semibold text-brand-ink">{classPhotoFiles[index]?.name}</p>
                        <p className="mt-1 text-xs text-stone-500">{formatFileSize(classPhotoFiles[index]?.size ?? 0)}</p>
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
                    value={classPhotoCaption}
                    onChange={(event) => setClassPhotoCaption(event.target.value)}
                    placeholder="Hoạt động, sản phẩm, khoảnh khắc nổi bật..."
                  />
                </label>
                <label className="block text-xs font-semibold text-stone-600">
                  URL ảnh dự phòng
                  <input
                    className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-3 py-2 text-sm text-brand-ink outline-none placeholder:text-stone-400 disabled:opacity-60"
                    value={classPhotoUrl}
                    disabled={classPhotoFiles.length > 0}
                    onChange={(event) => setClassPhotoUrl(event.target.value)}
                    placeholder="https://..."
                  />
                </label>
              </div>
              <div className="flex flex-col gap-2 xl:items-end xl:justify-end">
                <button
                  type="button"
                  disabled={photoSavingId === "class-album" || !selectedClass.sessionId}
                  onClick={() => void submitClassAlbumPhotos(selectedClass.id)}
                  className="glass-button-primary inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold disabled:opacity-50"
                >
                  <UploadCloud className="h-4 w-4" />
                  {photoSavingId === "class-album" ? "Đang lưu" : "Lưu album"}
                </button>
                {classPhotoFiles.length ? (
                  <button
                    type="button"
                    className="rounded-2xl border border-brand-red/15 px-4 py-2 text-xs font-semibold text-brand-red"
                    onClick={clearClassPhotoFiles}
                  >
                    Gỡ ảnh chọn
                  </button>
                ) : null}
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {selectedClassPhotos.length ? selectedClassPhotos.map((photo) => (
                <article key={photo.id} className="overflow-hidden rounded-2xl border border-brand-red/10 bg-white/45">
                  <a href={photo.url} target="_blank" rel="noreferrer" className="block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.url} alt={photo.caption || "Ảnh lớp học"} className="h-44 w-full object-cover" />
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
                <p className="rounded-2xl border border-brand-red/10 p-4 text-sm text-stone-500 md:col-span-2 2xl:col-span-3">Chưa có ảnh cho buổi học này.</p>
              )}
            </div>
          </section>

          <div className="content-border mt-4 overflow-hidden rounded-2xl">
            {selectedClass.students.length ? (
              <div className="divide-y divide-brand-red/10">
                {selectedClass.students.map((student) => {
                  const isExpanded = expandedStudentId === student.studentId

                  return (
                    <article key={student.studentId} className="p-3 transition hover:bg-white/35 hover:shadow-sm">
                      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="neu-pressed flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl">
                            <UserRound className="h-5 w-5 text-brand-red" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="truncate text-sm font-semibold text-brand-ink">{student.studentName}</h3>
                              {student.attendanceStatus ? (
                                <span className="rounded-full border border-brand-red/15 px-2 py-1 text-xs font-semibold text-brand-red">
                                  {attendanceStatusLabels[student.attendanceStatus]}
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 truncate text-xs text-stone-500">
                              {student.parentName} - {student.parentPhone} - còn {student.sessionsRemaining} buổi
                            </p>
                            {student.healthNote ? (
                              <p className="mt-2 rounded-2xl border border-brand-red/10 bg-white/55 px-3 py-2 text-xs font-semibold text-brand-red">
                                Lưu ý sức khỏe: {student.healthNote}
                              </p>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 xl:justify-end">
                          {attendanceActions.map((action) => {
                            const Icon = action.icon
                            const isActive = student.attendanceStatus === action.status
                            const saving = isSaving === `${student.studentId}-${action.status}`

                            return (
                              <button
                                key={action.status}
                                type="button"
                                disabled={saving || !student.enrollmentId}
                                onClick={() => void markAttendance(selectedClass.id, student, action.status)}
                                className={`neu-list-item inline-flex items-center justify-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
                                  isActive ? "text-brand-red" : "text-stone-600 hover:text-brand-red"
                                }`}
                              >
                                <Icon className="h-4 w-4" />
                                {saving ? "Lưu" : action.label}
                              </button>
                            )
                          })}
                          <button
                            type="button"
                            className="neu-list-item inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold text-stone-600 hover:text-brand-red"
                            onClick={() => setExpandedStudentId(isExpanded ? null : student.studentId)}
                          >
                            <StickyNote className="h-4 w-4" />
                            Ghi chú
                          </button>
                        </div>
                      </div>
                      {isExpanded ? (
                        <div className="content-border mt-3 grid gap-4 pt-3">
                          <label className="block text-xs font-semibold text-stone-600">
                            Ghi chú buổi học
                            <input
                              className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-3 py-2 text-sm text-brand-ink outline-none placeholder:text-stone-400"
                              value={noteDrafts[student.studentId] ?? student.attendanceNote ?? ""}
                              onChange={(event) => setNoteDrafts((current) => ({ ...current, [student.studentId]: event.target.value }))}
                              placeholder="Điểm nổi bật, lưu ý cần follow-up..."
                            />
                          </label>
                          <div className="rounded-2xl border border-brand-red/10 bg-white/35 p-3">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-widest text-brand-red">Ảnh bé</p>
                                <p className="mt-1 text-xs text-stone-500">
                                  Ảnh lưu nháp vào profile học viên. Admin/Sale duyệt trước khi phụ huynh thấy.
                                </p>
                              </div>
                              <span className="rounded-2xl border border-brand-red/10 px-3 py-2 text-xs font-semibold text-stone-600">
                                {student.photoCount} ảnh đã lưu
                              </span>
                            </div>
                            <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px_auto]">
                              <div className="space-y-3">
                                <label className="block text-xs font-semibold text-stone-600">
                                  Chọn ảnh của bé
                                  <input
                                    className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-3 py-2 text-sm text-brand-ink outline-none file:mr-3 file:rounded-xl file:border-0 file:bg-brand-red file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white disabled:opacity-60"
                                    type="file"
                                    multiple
                                    accept={classPhotoUploadAcceptedMimeTypes.join(",")}
                                    disabled={!student.attendanceId}
                                    onChange={(event) => selectStudentPhotoFiles(student.studentId, event)}
                                  />
                                </label>
                                {studentPhotoPreviewUrlsById[student.studentId]?.length ? (
                                  <div className="grid gap-2 sm:grid-cols-3">
                                    {studentPhotoPreviewUrlsById[student.studentId].map((url, index) => (
                                      <div key={url} className="rounded-2xl border border-brand-red/10 bg-white/45 p-2">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={url} alt={`Ảnh ${student.studentName} ${index + 1}`} className="h-24 w-full rounded-xl object-cover" />
                                        <p className="mt-2 truncate text-xs font-semibold text-brand-ink">{studentPhotoFilesById[student.studentId]?.[index]?.name}</p>
                                        <p className="mt-1 text-xs text-stone-500">{formatFileSize(studentPhotoFilesById[student.studentId]?.[index]?.size ?? 0)}</p>
                                      </div>
                                    ))}
                                  </div>
                                ) : null}
                                {!student.attendanceId ? (
                                  <p className="text-xs font-semibold text-stone-500">Điểm danh học viên trước, sau đó mới upload ảnh bé.</p>
                                ) : null}
                              </div>
                              <label className="block text-xs font-semibold text-stone-600">
                                Ghi chú ảnh
                                <textarea
                                  className="neu-pressed mt-2 min-h-20 w-full resize-none rounded-2xl bg-transparent px-3 py-2 text-sm text-brand-ink outline-none placeholder:text-stone-400"
                                  value={studentPhotoCaptionsById[student.studentId] ?? ""}
                                  onChange={(event) => setStudentPhotoCaptionsById((current) => ({ ...current, [student.studentId]: event.target.value }))}
                                  placeholder="Khoảnh khắc, sản phẩm, hoạt động của bé..."
                                />
                              </label>
                              <div className="flex flex-col gap-2 lg:items-end lg:justify-end">
                                <button
                                  type="button"
                                  disabled={!student.attendanceId || photoSavingId === `student-${student.studentId}`}
                                  onClick={() => void submitStudentPhotos(selectedClass.id, student)}
                                  className="glass-button-primary inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold disabled:opacity-50"
                                >
                                  <UploadCloud className="h-4 w-4" />
                                  {photoSavingId === `student-${student.studentId}` ? "Đang lưu" : "Lưu nháp"}
                                </button>
                                {studentPhotoFilesById[student.studentId]?.length ? (
                                  <button
                                    type="button"
                                    className="rounded-2xl border border-brand-red/15 px-4 py-2 text-xs font-semibold text-brand-red"
                                    onClick={() => clearStudentPhotoFiles(student.studentId)}
                                  >
                                    Gỡ ảnh chọn
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}
                      {!isExpanded && (student.attendanceNote || student.photoCount > 0) ? (
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-stone-500">
                          {student.attendanceNote ? (
                            <span className="inline-flex items-center gap-1 rounded-2xl border border-brand-red/10 px-3 py-1.5">
                              <StickyNote className="h-3.5 w-3.5 text-brand-red" />
                              {student.attendanceNote}
                            </span>
                          ) : null}
                          {student.photoCount > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-2xl border border-brand-red/10 px-3 py-1.5">
                              <ImagePlus className="h-3.5 w-3.5 text-brand-red" />
                              {student.photoCount} ảnh
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </article>
                  )
                })}
              </div>
            ) : (
              <p className="p-4 text-sm text-stone-500">Lớp này chưa có học viên active.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
