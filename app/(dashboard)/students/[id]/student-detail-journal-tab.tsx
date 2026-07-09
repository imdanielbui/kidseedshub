import { Eye, EyeOff, Save, Send, Star, Trash2 } from "lucide-react"
import { attendanceStatusLabels } from "@/lib/contracts/classes"
import type { StudentDetail } from "@/lib/contracts/students"
import { DetailInput } from "./student-detail-presentational"
import { photoReviewFilters, type PhotoReviewFilter } from "./student-detail-utils"

type StudentPhoto = StudentDetail["photos"][number]

export function StudentJournalTab({
  student,
  filteredPhotos,
  photoCaptionDrafts,
  photoCourseOptions,
  photoCourseFilter,
  photoDateFrom,
  photoDateTo,
  photoReviewFilter,
  photoSavingId,
  formatDate,
  onCaptionChange,
  onCourseFilterChange,
  onDateFromChange,
  onDateToChange,
  onDeletePhoto,
  onPatchPhoto,
  onResetFilters,
  onReviewFilterChange
}: {
  student: StudentDetail
  filteredPhotos: StudentPhoto[]
  photoCaptionDrafts: Record<string, string>
  photoCourseOptions: string[]
  photoCourseFilter: string
  photoDateFrom: string
  photoDateTo: string
  photoReviewFilter: PhotoReviewFilter
  photoSavingId: string | null
  formatDate: (value: string) => string
  onCaptionChange: (photoId: string, value: string) => void
  onCourseFilterChange: (value: string) => void
  onDateFromChange: (value: string) => void
  onDateToChange: (value: string) => void
  onDeletePhoto: (photoId: string) => void
  onPatchPhoto: (photoId: string, body: { caption?: string | null; isFeatured?: boolean; isPublished?: boolean; markSent?: boolean }) => void
  onResetFilters: () => void
  onReviewFilterChange: (value: PhotoReviewFilter) => void
}) {
  return (
    <section className="space-y-4">
      <div className="neu-card rounded-3xl p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-red">Media review</p>
            <h2 className="mt-1 text-xl font-semibold text-brand-ink">Ảnh & nhật ký phụ huynh</h2>
            <p className="mt-1 text-sm text-stone-600">Duyệt ảnh nháp của bé trước khi hiển thị trong cổng phụ huynh.</p>
            {!student.permissions.canPublishPhotos ? (
              <p className="mt-2 rounded-2xl border border-brand-red/10 bg-white/55 px-3 py-2 text-xs font-semibold text-stone-500">
                Tài khoản này chỉ xem/sửa ghi chú ảnh, không có quyền gửi ảnh cho phụ huynh.
              </p>
            ) : null}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs font-semibold text-stone-600">
            <span className="rounded-2xl border border-brand-red/10 px-3 py-2">{student.photos.length} ảnh</span>
            <span className="rounded-2xl border border-brand-red/10 px-3 py-2">{student.photos.filter((photo) => !photo.isPublished).length} nháp</span>
            <span className="rounded-2xl border border-brand-red/10 px-3 py-2">{student.photos.filter((photo) => photo.isPublished).length} đã gửi</span>
          </div>
        </div>

        <div className="content-border mt-4 grid gap-3 pt-4 lg:grid-cols-[auto_minmax(160px,220px)_repeat(2,minmax(140px,180px))_auto] lg:items-end">
          <div className="flex flex-wrap gap-2">
            {photoReviewFilters.map((filter) => (
              <button
                key={filter.key}
                type="button"
                className={`rounded-2xl border px-4 py-2 text-xs font-semibold ${photoReviewFilter === filter.key ? "border-brand-red bg-brand-red text-white" : "border-brand-red/15 text-stone-600"}`}
                onClick={() => onReviewFilterChange(filter.key)}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <label className="block text-xs font-semibold text-stone-600">
            Khóa học
            <select
              className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-3 py-2 text-sm text-brand-ink outline-none"
              value={photoCourseFilter}
              onChange={(event) => onCourseFilterChange(event.target.value)}
            >
              <option value="ALL">Tất cả khóa</option>
              {photoCourseOptions.map((courseName) => (
                <option key={courseName} value={courseName}>{courseName}</option>
              ))}
            </select>
          </label>
          <DetailInput label="Từ ngày" type="date" value={photoDateFrom} onChange={onDateFromChange} />
          <DetailInput label="Đến ngày" type="date" value={photoDateTo} onChange={onDateToChange} />
          <button
            type="button"
            className="rounded-2xl border border-brand-red/15 px-4 py-3 text-xs font-semibold text-brand-red"
            onClick={onResetFilters}
          >
            Xóa lọc
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filteredPhotos.length ? filteredPhotos.map((photo) => (
          <article key={photo.id} className="neu-card overflow-hidden rounded-3xl">
            <a href={photo.url} target="_blank" rel="noreferrer" className="block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt={photo.caption || `Ảnh ${student.name}`} className="h-52 w-full object-cover" />
            </a>
            <div className="space-y-3 p-4">
              <div className="flex flex-wrap gap-2 text-xs font-semibold">
                <span className={`rounded-full border px-2 py-1 ${photo.isPublished ? "border-emerald-200 text-emerald-700" : "border-brand-red/15 text-stone-500"}`}>
                  {photo.isPublished ? "Phụ huynh thấy" : "Nháp"}
                </span>
                {photo.isFeatured ? <span className="rounded-full border border-amber-200 px-2 py-1 text-amber-700">Nổi bật</span> : null}
                {photo.sentToParentAt ? <span className="rounded-full border border-brand-red/10 px-2 py-1 text-stone-500">Đã gửi {formatDate(photo.sentToParentAt)}</span> : null}
              </div>
              <div>
                <p className="text-xs font-semibold text-brand-red">{formatDate(photo.takenAt)}</p>
                <p className="mt-1 text-sm font-semibold text-brand-ink">{photo.className ?? "Chưa gắn lớp"}</p>
                <p className="mt-1 text-xs text-stone-500">
                  {[photo.courseName, photo.attendanceStatus ? attendanceStatusLabels[photo.attendanceStatus] : undefined, photo.createdByName ? `Upload bởi ${photo.createdByName}` : undefined].filter(Boolean).join(" · ") || "Ảnh học viên"}
                </p>
              </div>
              <textarea
                className="neu-pressed min-h-20 w-full resize-none rounded-2xl bg-transparent px-3 py-2 text-sm text-brand-ink outline-none placeholder:text-stone-400"
                value={photoCaptionDrafts[photo.id] ?? ""}
                onChange={(event) => onCaptionChange(photo.id, event.target.value)}
                placeholder="Caption gửi phụ huynh..."
              />
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={photoSavingId === photo.id}
                  className="neu-list-item inline-flex items-center justify-center gap-1 rounded-2xl px-3 py-2 text-xs font-semibold text-stone-600 hover:text-brand-red disabled:opacity-50"
                  onClick={() => onPatchPhoto(photo.id, { caption: photoCaptionDrafts[photo.id] ?? "" })}
                >
                  <Save className="h-3.5 w-3.5" />
                  Lưu caption
                </button>
                {student.permissions.canPublishPhotos ? (
                  <>
                    <button
                      type="button"
                      disabled={photoSavingId === photo.id}
                      className="neu-list-item inline-flex items-center justify-center gap-1 rounded-2xl px-3 py-2 text-xs font-semibold text-stone-600 hover:text-brand-red disabled:opacity-50"
                      onClick={() => onPatchPhoto(photo.id, { isFeatured: !photo.isFeatured })}
                    >
                      <Star className="h-3.5 w-3.5" />
                      {photo.isFeatured ? "Bỏ nổi bật" : "Nổi bật"}
                    </button>
                    <button
                      type="button"
                      disabled={photoSavingId === photo.id}
                      className="neu-list-item inline-flex items-center justify-center gap-1 rounded-2xl px-3 py-2 text-xs font-semibold text-stone-600 hover:text-brand-red disabled:opacity-50"
                      onClick={() => onPatchPhoto(photo.id, photo.isPublished ? { isPublished: false } : { markSent: true })}
                    >
                      {photo.isPublished ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      {photo.isPublished ? "Ẩn khỏi PH" : "Publish"}
                    </button>
                    <button
                      type="button"
                      disabled={photoSavingId === photo.id || photo.isPublished}
                      className="neu-list-item inline-flex items-center justify-center gap-1 rounded-2xl px-3 py-2 text-xs font-semibold text-stone-600 hover:text-brand-red disabled:opacity-50"
                      onClick={() => onPatchPhoto(photo.id, { markSent: true })}
                    >
                      <Send className="h-3.5 w-3.5" />
                      Gửi PH
                    </button>
                    <button
                      type="button"
                      disabled={photoSavingId === photo.id}
                      className="neu-list-item col-span-2 inline-flex items-center justify-center gap-1 rounded-2xl px-3 py-2 text-xs font-semibold text-brand-red disabled:opacity-50"
                      onClick={() => onDeletePhoto(photo.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Xóa ảnh
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          </article>
        )) : (
          <p className="neu-card rounded-3xl p-6 text-sm text-stone-500 md:col-span-2 xl:col-span-3">
            Chưa có ảnh phù hợp bộ lọc. Ảnh bé được upload từ màn hình điểm danh sẽ xuất hiện ở đây dưới trạng thái nháp.
          </p>
        )}
      </div>
    </section>
  )
}
