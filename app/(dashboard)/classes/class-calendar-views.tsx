"use client"

import { CalendarCheck2, CircleAlert, CircleCheck, UsersRound } from "lucide-react"
import type { Dispatch, SetStateAction } from "react"
import type { ClassCalendarSessionItem } from "@/lib/contracts/courses"
import type { ScheduleEventItem } from "@/lib/contracts/schedule-events"
import {
  defaultDate,
  monthTitle,
  sessionTone,
  toDateKey,
  weekdayColumns,
  weekTitle
} from "./class-schedule-utils"
import { WeeklyTimeGrid } from "./weekly-time-grid"

type CalendarViewProps = {
  month: string
  monthCells: Date[]
  sessionsByDate: Record<string, ClassCalendarSessionItem[]>
  eventsByDate: Record<string, ScheduleEventItem[]>
  isLoading: boolean
  canManageSchedule: boolean
  draggingSessionId: string | null
  setDraggingSessionId: Dispatch<SetStateAction<string | null>>
  setSelectedSession: Dispatch<SetStateAction<ClassCalendarSessionItem | null>>
  dropSessionOnDate: (date: Date) => void
}

type WeekViewProps = Omit<CalendarViewProps, "month" | "monthCells"> & {
  weekStart: Date
  weekCells: Date[]
  sessionsLength: number
}

export function MonthCalendarView({
  month,
  monthCells,
  sessionsByDate,
  eventsByDate,
  isLoading,
  canManageSchedule,
  draggingSessionId,
  setDraggingSessionId,
  setSelectedSession,
  dropSessionOnDate
}: CalendarViewProps) {
  return (
    <div className="content-border mt-5 p-3">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xl font-semibold capitalize text-brand-ink">{monthTitle(month)}</h3>
        <WeeklyScheduleLegend />
      </div>
      <div className="grid grid-cols-7 border-l border-t border-brand-red/10">
        {weekdayColumns.map((day) => (
          <div key={day.value} className="border-b border-r border-brand-red/10 bg-white/40 p-2 text-center text-xs font-semibold text-brand-ink">
            {day.label}
          </div>
        ))}
        {monthCells.map((date) => {
          const key = toDateKey(date)
          const daySessions = sessionsByDate[key] ?? []
          const dayEvents = eventsByDate[key] ?? []
          const isCurrentMonth = key.startsWith(month)
          const isToday = key === defaultDate
          const isBlocked = dayEvents.some((event) => event.affectsScheduling)

          return (
            <div
              key={key}
              className={`min-h-32 border-b border-r border-brand-red/10 p-1 transition-colors ${isCurrentMonth ? "bg-white/25" : "bg-stone-100/40"} ${
                isToday ? "bg-brand-red/5" : ""
              } ${isBlocked ? "bg-brand-red/10" : ""}`}
              onDragOver={(event) => {
                if (!canManageSchedule || isBlocked) return
                event.preventDefault()
              }}
              onDrop={(event) => {
                if (isBlocked) return
                event.preventDefault()
                dropSessionOnDate(date)
              }}
            >
              <div className={`mb-1 text-right text-xs ${isCurrentMonth ? "text-brand-ink" : "text-stone-400"}`}>{date.getDate()}</div>
              <div className="space-y-1">
                {dayEvents.map((event) => (
                  <ScheduleEventBadge key={event.id} event={event} compact />
                ))}
                {isLoading ? <p className="rounded border border-brand-red/10 p-1 text-xs text-stone-400">...</p> : null}
                {daySessions.map((session) => (
                  <CalendarSessionButton
                    key={session.id}
                    session={session}
                    canDrag={canManageSchedule}
                    isDragging={draggingSessionId === session.id}
                    setDraggingSessionId={setDraggingSessionId}
                    setSelectedSession={setSelectedSession}
                    compact
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function WeekCalendarView({
  weekStart,
  weekCells,
  sessionsLength,
  sessionsByDate,
  eventsByDate,
  isLoading,
  canManageSchedule,
  draggingSessionId,
  setDraggingSessionId,
  setSelectedSession,
  dropSessionOnDate
}: WeekViewProps) {
  const weeklySessions = weekCells.flatMap((date) => sessionsByDate[toDateKey(date)] ?? [])
  const completedSessions = weeklySessions.filter((session) => session.status === "COMPLETED").length
  const expectedStudents = weeklySessions.reduce((total, session) => total + session.studentCount, 0)
  const pendingPastSessions = weeklySessions.filter((session) => session.status === "SCHEDULED" && session.date <= defaultDate).length

  return (
    <div className="content-border mt-5 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-red">Vận hành tuần</p>
          <h3 className="mt-1 text-xl font-semibold capitalize text-brand-ink">{weekTitle(weekStart)}</h3>
          <p className="mt-1 text-xs text-stone-500">Theo dõi lịch lớp, tiến độ buổi học và khối lượng vận hành theo khung giờ.</p>
        </div>
        <ClassScheduleLegend />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <WeeklyMetric icon={<CalendarCheck2 className="h-4 w-4" />} label="Buổi trong tuần" value={`${sessionsLength}`} detail="Đã sinh lịch" />
        <WeeklyMetric icon={<UsersRound className="h-4 w-4" />} label="Lượt học viên dự kiến" value={`${expectedStudents}`} detail="Theo sĩ số từng buổi" />
        <WeeklyMetric icon={<CircleCheck className="h-4 w-4" />} label="Buổi hoàn tất" value={`${completedSessions}`} detail="Đã cập nhật trạng thái" tone="success" />
        <WeeklyMetric icon={<CircleAlert className="h-4 w-4" />} label="Cần xác nhận" value={`${pendingPastSessions}`} detail="Buổi quá ngày chưa chốt" tone="attention" />
      </div>
      <div className="mt-4 overflow-hidden rounded-2xl border border-brand-red/10 bg-white/25 p-2">
      <WeeklyTimeGrid
        weekCells={weekCells}
        sessionsByDate={sessionsByDate}
        eventsByDate={eventsByDate}
        isLoading={isLoading}
        canManageSchedule={canManageSchedule}
        draggingSessionId={draggingSessionId}
        setDraggingSessionId={setDraggingSessionId}
        setSelectedSession={setSelectedSession}
        dropSessionOnDate={dropSessionOnDate}
      />
      </div>
    </div>
  )
}

function WeeklyMetric({ icon, label, value, detail, tone = "default" }: { icon: React.ReactNode; label: string; value: string; detail: string; tone?: "default" | "success" | "attention" }) {
  const toneClass = tone === "success" ? "text-emerald-700" : tone === "attention" ? "text-brand-red" : "text-brand-ink"
  return (
    <div className="rounded-2xl border border-brand-red/10 bg-white/55 px-4 py-3">
      <div className={`flex items-center gap-2 text-xs font-semibold ${toneClass}`}>{icon}{label}</div>
      <p className={`mt-2 text-2xl font-semibold ${toneClass}`}>{value}</p>
      <p className="mt-1 text-xs text-stone-500">{detail}</p>
    </div>
  )
}

function ClassScheduleLegend() {
  return (
    <div className="flex gap-2 text-xs font-semibold">
      <span className="rounded-full bg-lime-500 px-2 py-1 text-white">FUN</span>
      <span className="rounded-full bg-indigo-500 px-2 py-1 text-white">Robotics</span>
      <span className="rounded-full bg-brand-red px-2 py-1 text-white">Nghỉ lễ</span>
    </div>
  )
}

function WeeklyScheduleLegend() {
  return (
    <div className="flex gap-2 text-xs font-semibold">
      <span className="rounded-full bg-amber-500 px-2 py-1 text-white">FUN</span>
      <span className="rounded-full bg-brand-red px-2 py-1 text-white">Robotics</span>
      <span className="rounded-full bg-stone-500 px-2 py-1 text-white">Nghỉ lễ</span>
    </div>
  )
}

function ScheduleEventBadge({ event, compact = false }: { event: ScheduleEventItem; compact?: boolean }) {
  return (
    <div
      className={`${compact ? "rounded px-1.5 py-1" : "rounded-2xl px-2 py-2"} text-[11px] font-semibold ${
        event.affectsScheduling ? "bg-brand-red text-white" : "bg-amber-100 text-amber-700"
      }`}
    >
      <span className="block truncate">{event.title}</span>
    </div>
  )
}

function CalendarSessionButton({
  session,
  canDrag,
  isDragging,
  setDraggingSessionId,
  setSelectedSession,
  compact = false
}: {
  session: ClassCalendarSessionItem
  canDrag: boolean
  isDragging: boolean
  setDraggingSessionId: Dispatch<SetStateAction<string | null>>
  setSelectedSession: Dispatch<SetStateAction<ClassCalendarSessionItem | null>>
  compact?: boolean
}) {
  return (
    <button
      type="button"
      draggable={canDrag}
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", session.id)
        setDraggingSessionId(session.id)
      }}
      onDragEnd={() => setDraggingSessionId(null)}
      onClick={() => setSelectedSession(session)}
      className={`w-full border text-left text-xs font-semibold shadow-sm transition hover:shadow-md ${sessionTone(session)} ${
        compact ? "rounded px-1.5 py-1 text-[11px] leading-4" : "rounded-2xl px-3 py-2 leading-5"
      } ${isDragging ? "opacity-60" : ""}`}
    >
      <span className="block truncate">
        {session.startTime} - {session.endTime}
      </span>
      <span className="block truncate">{session.className}</span>
      {!compact ? <span className="mt-1 block truncate text-[11px] opacity-80">GV {session.substituteTeacherName ?? session.teacherName}</span> : null}
    </button>
  )
}
