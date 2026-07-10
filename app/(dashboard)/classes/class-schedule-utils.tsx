import { classPhotoUploadAcceptedMimeTypes } from "@/lib/contracts/classes"
import type { ClassCalendarSessionItem } from "@/lib/contracts/courses"

export const weekdayColumns = [
  { value: 1, label: "Thứ Hai", short: "T2" },
  { value: 2, label: "Thứ Ba", short: "T3" },
  { value: 3, label: "Thứ Tư", short: "T4" },
  { value: 4, label: "Thứ Năm", short: "T5" },
  { value: 5, label: "Thứ Sáu", short: "T6" },
  { value: 6, label: "Thứ Bảy", short: "T7" },
  { value: 0, label: "Chủ Nhật", short: "CN" }
]

export const today = new Date()
export const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`
export const defaultDate = today.toISOString().slice(0, 10)

export function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

export function monthTitle(month: string) {
  const [year, value] = month.split("-").map(Number)
  return new Intl.DateTimeFormat("vi-VN", { month: "long", year: "numeric" }).format(new Date(year, value - 1, 1))
}

export function formatWeekdayDate(date: Date) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit" }).format(date)
}

export function weekTitle(weekStart: Date) {
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)

  return `Tuần ${formatWeekdayDate(weekStart)} - ${new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(weekEnd)}`
}

export function shiftMonth(month: string, delta: number) {
  const [year, value] = month.split("-").map(Number)
  const date = new Date(year, value - 1 + delta, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

export function monthKeyFromDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

export function startOfWeek(date: Date) {
  const value = new Date(date)
  value.setHours(0, 0, 0, 0)
  const startOffset = (value.getDay() + 6) % 7
  value.setDate(value.getDate() - startOffset)
  return value
}

export function shiftWeek(weekStart: Date, delta: number) {
  const date = new Date(weekStart)
  date.setDate(weekStart.getDate() + delta * 7)
  return startOfWeek(date)
}

export function getMonthCells(month: string) {
  const [year, value] = month.split("-").map(Number)
  const firstDay = new Date(year, value - 1, 1)
  const startOffset = (firstDay.getDay() + 6) % 7
  const firstCell = new Date(firstDay)
  firstCell.setDate(firstDay.getDate() - startOffset)

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstCell)
    date.setDate(firstCell.getDate() + index)
    return date
  })
}

export function getWeekCells(weekStart: Date) {
  const firstCell = startOfWeek(weekStart)

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(firstCell)
    date.setDate(firstCell.getDate() + index)
    return date
  })
}

export function uniqueMonthKeys(dates: Date[]) {
  return Array.from(new Set(dates.map(monthKeyFromDate)))
}

export function uniqueById<T extends { id: string }>(items: T[]) {
  return Array.from(new Map(items.map((item) => [item.id, item])).values())
}

export function sessionTone(session: ClassCalendarSessionItem) {
  if (session.status === "CANCELED") return "border-stone-300 bg-stone-200 text-stone-600"
  if (session.status === "COMPLETED") return "border-emerald-600 bg-emerald-600 text-white"
  return session.subject === "FUN" ? "border-lime-500 bg-lime-500 text-white" : "border-indigo-500 bg-indigo-500 text-white"
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function isAcceptedPhotoFile(file: File) {
  return classPhotoUploadAcceptedMimeTypes.includes(
    file.type as (typeof classPhotoUploadAcceptedMimeTypes)[number]
  )
}

export function ClassMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-brand-red/10 bg-white/45 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-brand-ink">{value}</p>
    </div>
  )
}
