"use client"

import { CalendarDays, CheckCircle2, Clock3, Users } from "lucide-react"
import { useEffect, useState, type ReactNode } from "react"
import { DialogShell } from "@/components/shared/dialog-shell"
import type { ApiResponse } from "@/lib/api-response"
import { attendanceStatusLabels, type ClassTimelineItem } from "@/lib/contracts/classes"
import { ClassAttendanceMatrix, type ClassAttendanceDetailSelection } from "./class-attendance-matrix"

type ClassTimelineDialogProps = {
  classId: string
  onClose: () => void
  panelClassName: string
}

function formatDate(value?: string) {
  if (!value) return "Chưa có"
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${value}T12:00:00`))
}

export function ClassTimelineDialog({ classId, onClose, panelClassName }: ClassTimelineDialogProps) {
  const [timeline, setTimeline] = useState<ClassTimelineItem | null>(null)
  const [selectedAttendance, setSelectedAttendance] = useState<ClassAttendanceDetailSelection | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const controller = new AbortController()

    async function loadTimeline() {
      setIsLoading(true)
      setError("")

      try {
        const response = await fetch(`/api/classes/${classId}/timeline`, { cache: "no-store", signal: controller.signal })
        const payload = (await response.json()) as ApiResponse<ClassTimelineItem>

        if (!response.ok || !payload.success || !payload.data) {
          setError(payload.error?.message ?? "Không tải được tiến độ lớp học.")
          return
        }

        setTimeline(payload.data)
        setSelectedAttendance(null)
      } catch (requestError) {
        if (requestError instanceof DOMException && requestError.name === "AbortError") return
        setError("Không tải được tiến độ lớp học.")
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }

    void loadTimeline()
    return () => controller.abort()
  }, [classId])

  const completedCount = timeline?.sessions.filter((session) => session.attendanceState === "COMPLETE").length ?? 0
  const markedCount = timeline?.sessions.filter((session) => session.attendanceMarked > 0).length ?? 0

  return (
    <>
    <DialogShell
      eyebrow="Tiến độ lớp"
      title={timeline?.name ?? "Lịch học và điểm danh"}
      description={timeline ? `${timeline.code ? `${timeline.code} · ` : ""}${timeline.courseName} · GV ${timeline.teacherName}` : "Đang tải dữ liệu lớp học."}
      onClose={onClose}
      closeLabel="Đóng tiến độ lớp"
      size="xl"
      panelClassName={panelClassName}
      bodyClassName="bg-[#fffaf7] p-0"
    >
      {isLoading ? (
        <div className="p-5 text-sm text-stone-500">Đang tải lịch học và điểm danh...</div>
      ) : error ? (
        <div className="p-5"><p className="rounded-2xl border border-brand-red/15 bg-white/60 p-4 text-sm text-brand-red">{error}</p></div>
      ) : timeline ? (
        <div className="min-h-0">
          <div className="content-border grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-5">
            <TimelineMetric icon={<CalendarDays className="h-4 w-4" />} label="Khai giảng" value={formatDate(timeline.startDate)} />
            <TimelineMetric icon={<CalendarDays className="h-4 w-4" />} label="Kết thúc dự kiến" value={formatDate(timeline.endDate)} />
            <TimelineMetric icon={<Clock3 className="h-4 w-4" />} label="Lịch đã sinh" value={`${timeline.sessions.length}/${timeline.plannedSessions ?? timeline.sessions.length} buổi`} />
            <TimelineMetric icon={<CheckCircle2 className="h-4 w-4" />} label="Đã điểm danh đủ" value={`${completedCount} buổi`} />
            <TimelineMetric icon={<Users className="h-4 w-4" />} label="Học sinh active" value={`${timeline.activeStudentCount} bé`} />
          </div>

          <div className="border-b border-brand-red/10 px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-sm font-semibold text-brand-ink">Tổng quan điểm danh</p><p className="mt-1 text-xs text-stone-500">Theo dõi nhanh số buổi đã ghi nhận; chi tiết nằm trong sổ điểm danh bên dưới.</p></div>
              <span className="rounded-full border border-brand-red/15 px-3 py-1.5 text-xs font-semibold text-brand-red">{markedCount}/{timeline.sessions.length} buổi đã có điểm danh</span>
            </div>
          </div>

          {timeline.sessions.length ? (
            <ClassAttendanceMatrix
              timeline={timeline}
              onSelectAttendance={setSelectedAttendance}
            />
          ) : <p className="m-5 rounded-2xl border border-brand-red/10 p-4 text-sm text-stone-500">Lớp này chưa có buổi học nào được sinh lịch.</p>}
        </div>
      ) : null}
    </DialogShell>

    {selectedAttendance ? <AttendanceCellDetailDialog selection={selectedAttendance} onClose={() => setSelectedAttendance(null)} /> : null}
    </>
  )
}

function TimelineMetric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="rounded-2xl border border-brand-red/10 bg-white/55 px-3 py-3"><div className="flex items-center gap-2 text-xs font-semibold text-stone-500">{icon}{label}</div><p className="mt-2 text-sm font-semibold text-brand-ink">{value}</p></div>
}

function AttendanceCellDetailDialog({ selection, onClose }: { selection: ClassAttendanceDetailSelection; onClose: () => void }) {
  const { session, student } = selection
  const status = student.attendanceStatus
    ? attendanceStatusLabels[student.attendanceStatus]
    : session.attendanceState === "CANCELED"
      ? "Buổi đã hủy"
      : session.attendanceState === "UPCOMING"
        ? "Buổi sắp diễn ra"
        : "Chưa điểm danh"

  return (
    <DialogShell
      eyebrow="Chi tiết điểm danh"
      title={student.studentName}
      description={`Buổi ${session.sessionNumber} · ${formatDate(session.date)}`}
      onClose={onClose}
      closeLabel="Đóng chi tiết điểm danh"
      size="md"
      zIndexClassName="z-[60]"
      bodyClassName="space-y-4 bg-[#fffaf7] p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-brand-red/10 bg-white/55 px-3 py-2.5">
        <span className="text-xs text-stone-500">Trạng thái buổi học</span>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${student.attendanceStatus ? "border-emerald-500/30 bg-emerald-50 text-emerald-800" : "border-brand-red/20 bg-brand-red/5 text-brand-red"}`}>{status}</span>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2">
        <DetailField label="Mã học viên" value={student.studentCode ?? "Chưa có mã"} />
        <DetailField label="Phụ huynh" value={student.parentName} />
        <DetailField label="Số điện thoại" value={student.parentPhone} />
        <DetailField label="Thời gian" value={`${session.startTime}-${session.endTime}`} />
        <DetailField label="Ngày học" value={formatDate(session.date)} />
        <DetailField label="Phòng học" value={session.room ?? "Chưa xếp phòng"} />
      </dl>
      {student.attendanceNote ? <DetailField label="Ghi chú điểm danh" value={student.attendanceNote} /> : null}
      {student.markedByName ? <DetailField label="Điểm danh bởi" value={student.markedByName} /> : null}
    </DialogShell>
  )
}

function DetailField({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-brand-red/10 bg-white/55 px-3 py-2.5"><dt className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">{label}</dt><dd className="mt-1 text-sm font-medium text-brand-ink">{value}</dd></div>
}
