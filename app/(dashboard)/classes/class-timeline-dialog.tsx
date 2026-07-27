"use client"

import { CalendarDays, CheckCircle2, CircleAlert, Clock3, Users } from "lucide-react"
import { useEffect, useMemo, useState, type ReactNode } from "react"
import { DialogShell } from "@/components/shared/dialog-shell"
import type { ApiResponse } from "@/lib/api-response"
import { attendanceStatusLabels, type ClassTimelineItem, type ClassTimelineSession } from "@/lib/contracts/classes"

type ClassTimelineDialogProps = {
  classId: string
  onClose: () => void
  panelClassName: string
}

const sessionStateMeta = {
  UPCOMING: { label: "Sắp diễn ra", className: "border-stone-200 bg-white/70 text-stone-600" },
  PENDING: { label: "Chưa điểm danh", className: "border-brand-red/25 bg-brand-red/5 text-brand-red" },
  PARTIAL: { label: "Điểm danh một phần", className: "border-amber-400/35 bg-amber-50 text-amber-800" },
  COMPLETE: { label: "Đã điểm danh", className: "border-emerald-500/30 bg-emerald-50 text-emerald-800" },
  CANCELED: { label: "Đã hủy", className: "border-stone-200 bg-stone-100 text-stone-500" }
} as const

function formatDate(value?: string) {
  if (!value) return "Chưa có"
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${value}T12:00:00`))
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit" }).format(new Date(`${value}T12:00:00`))
}

export function ClassTimelineDialog({ classId, onClose, panelClassName }: ClassTimelineDialogProps) {
  const [timeline, setTimeline] = useState<ClassTimelineItem | null>(null)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
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
        const preferredSession = payload.data.sessions.find((session) => session.attendanceState === "PENDING" || session.attendanceState === "PARTIAL")
          ?? payload.data.sessions.find((session) => session.attendanceState === "COMPLETE")
          ?? payload.data.sessions[0]
        setSelectedSessionId(preferredSession?.id ?? null)
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

  const selectedSession = useMemo(
    () => timeline?.sessions.find((session) => session.id === selectedSessionId) ?? null,
    [selectedSessionId, timeline]
  )
  const completedCount = timeline?.sessions.filter((session) => session.attendanceState === "COMPLETE").length ?? 0
  const markedCount = timeline?.sessions.filter((session) => session.attendanceMarked > 0).length ?? 0
  const billableSessions = timeline?.sessions.filter((session) => session.attendanceState !== "CANCELED") ?? []
  const attendanceExpected = billableSessions.reduce((total, session) => total + session.attendanceExpected, 0)
  const attendanceMarked = billableSessions.reduce((total, session) => total + session.attendanceMarked, 0)
  const attendanceRate = attendanceExpected ? Math.round((attendanceMarked / attendanceExpected) * 100) : 0
  const plannedSessions = timeline?.plannedSessions ?? timeline?.sessions.length ?? 0
  const progressPercent = plannedSessions ? Math.min(100, Math.round((completedCount / plannedSessions) * 100)) : 0

  return (
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
        <div className="min-h-0 p-4 sm:p-5">
          <section className="overflow-hidden rounded-2xl border border-brand-red/10 bg-white/60">
            <div className="grid gap-5 border-b border-brand-red/10 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-brand-red/10 px-2.5 py-1 text-[11px] font-semibold text-brand-red">Lớp đang vận hành</span>
                  <span className="text-xs font-medium text-stone-500">{formatDate(timeline.startDate)} - {formatDate(timeline.endDate)}</span>
                </div>
                <div className="mt-3 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-2xl font-semibold text-brand-ink">{completedCount}<span className="ml-1 text-sm font-medium text-stone-500">/ {plannedSessions} buổi hoàn tất</span></p>
                    <p className="mt-1 text-xs text-stone-500">Một buổi hoàn tất khi roster đã được điểm danh đầy đủ.</p>
                  </div>
                  <p className="text-lg font-semibold text-brand-red">{progressPercent}%</p>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-brand-red/10"><div className="h-full rounded-full bg-brand-red transition-all" style={{ width: `${progressPercent}%` }} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
                <TimelineMetric icon={<Users className="h-4 w-4" />} label="Học viên" value={`${timeline.activeStudentCount} bé`} />
                <TimelineMetric icon={<CheckCircle2 className="h-4 w-4" />} label="Điểm danh" value={`${attendanceRate}%`} />
                <TimelineMetric icon={<Clock3 className="h-4 w-4" />} label="Đã ghi nhận" value={`${markedCount} buổi`} />
                <TimelineMetric icon={<CalendarDays className="h-4 w-4" />} label="Lịch đã sinh" value={`${timeline.sessions.length} buổi`} />
              </div>
            </div>

            {timeline.sessions.length ? (
              <div className="grid min-h-0 lg:grid-cols-[minmax(330px,0.9fr)_minmax(380px,1.1fr)]">
                <section className="min-h-0 border-b border-brand-red/10 bg-[#fffdfb] p-4 lg:max-h-[52vh] lg:overflow-auto lg:border-b-0 lg:border-r">
                  <div className="flex items-start justify-between gap-3">
                    <div><p className="text-sm font-semibold text-brand-ink">Lộ trình buổi học</p><p className="mt-1 text-xs text-stone-500">Chọn một buổi để kiểm tra điểm danh.</p></div>
                    <span className="rounded-full border border-brand-red/15 px-2.5 py-1 text-[11px] font-semibold text-brand-red">{markedCount}/{timeline.sessions.length} đã ghi nhận</span>
                  </div>
                  <div className="mt-4 space-y-2">
                    {timeline.sessions.map((session) => <SessionTimelineButton key={session.id} session={session} selected={session.id === selectedSessionId} onSelect={() => setSelectedSessionId(session.id)} />)}
                  </div>
                </section>
                <AttendanceDetail session={selectedSession} />
              </div>
            ) : <p className="m-4 rounded-xl border border-brand-red/10 bg-[#fffdfb] p-4 text-sm text-stone-500">Lớp này chưa có buổi học nào được sinh lịch.</p>}
          </section>
        </div>
      ) : null}
    </DialogShell>
  )
}

function TimelineMetric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="min-w-[118px] rounded-xl border border-brand-red/10 bg-[#fffaf7] px-3 py-2.5"><div className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-500">{icon}{label}</div><p className="mt-1.5 text-sm font-semibold text-brand-ink">{value}</p></div>
}

function SessionTimelineButton({ session, selected, onSelect }: { session: ClassTimelineSession; selected: boolean; onSelect: () => void }) {
  const meta = sessionStateMeta[session.attendanceState]
  return <button type="button" onClick={onSelect} className={`group relative flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${meta.className} ${selected ? "border-brand-red bg-white shadow-sm ring-1 ring-brand-red/35" : "hover:border-brand-red/35 hover:bg-white/80"}`}>
    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border text-xs font-bold ${selected ? "border-brand-red bg-brand-red text-white" : "border-current/20 bg-white/65"}`}>{session.sessionNumber}</span>
    <span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold text-brand-ink">{formatShortDate(session.date)}</span><span className="shrink-0 text-[11px] font-semibold">{session.attendanceMarked}/{session.attendanceExpected}</span></span><span className="mt-1 block text-xs text-stone-600">{session.startTime}-{session.endTime}{session.room ? ` · ${session.room}` : ""}</span></span>
    <span className="hidden shrink-0 text-[11px] font-semibold sm:block">{meta.label}</span>
  </button>
}

function AttendanceDetail({ session }: { session: ClassTimelineSession | null }) {
  if (!session) return <aside className="p-4 text-sm text-stone-500">Chọn một buổi học để xem điểm danh.</aside>
  const meta = sessionStateMeta[session.attendanceState]
  return <aside className="min-h-0 bg-white/45 p-4 lg:max-h-[52vh] lg:overflow-auto">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[11px] font-semibold uppercase tracking-widest text-brand-red">Buổi đang xem</p><p className="mt-1 text-lg font-semibold text-brand-ink">Buổi {session.sessionNumber} · {formatDate(session.date)}</p><p className="mt-1 text-xs text-stone-500">{session.startTime}-{session.endTime}{session.room ? ` · ${session.room}` : ""}</p></div><span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${meta.className}`}>{meta.label}</span></div>
    <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-brand-red/10 bg-[#fffaf7] px-3 py-2.5 text-xs text-stone-600"><span className="flex items-center gap-2"><CircleAlert className="h-4 w-4 text-brand-red" />Tiến độ điểm danh</span><span className="font-semibold text-brand-ink">{session.attendanceMarked}/{session.attendanceExpected} học viên</span></div>
    <div className="mt-4"><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-brand-ink">Danh sách học viên</p><p className="text-xs text-stone-500">{session.students.length} bé</p></div>
      <div className="mt-2 space-y-2">
        {session.students.length ? session.students.map((student) => <div key={student.studentId} className="rounded-xl border border-brand-red/10 bg-white px-3 py-2.5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-brand-ink">{student.studentName}</p><p className="mt-1 truncate text-xs text-stone-500">{student.parentName} · {student.parentPhone}</p></div><span className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-semibold ${student.attendanceStatus ? "border-emerald-500/30 bg-emerald-50 text-emerald-800" : "border-brand-red/20 bg-brand-red/5 text-brand-red"}`}>{student.attendanceStatus ? attendanceStatusLabels[student.attendanceStatus] : "Chưa điểm danh"}</span></div>{student.attendanceNote ? <p className="mt-2 text-xs text-stone-600">Ghi chú: {student.attendanceNote}</p> : null}{student.markedByName ? <p className="mt-1 text-[11px] text-stone-500">Điểm danh bởi {student.markedByName}</p> : null}</div>) : <p className="rounded-xl border border-brand-red/10 p-3 text-sm text-stone-500">Buổi học này chưa có danh sách học viên.</p>}
      </div>
    </div>
  </aside>
}
