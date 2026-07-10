"use client"

import type { Dispatch, SetStateAction } from "react"
import type { ClassCalendarSessionItem } from "@/lib/contracts/courses"
import type { ScheduleEventItem } from "@/lib/contracts/schedule-events"
import {
  defaultDate,
  formatWeekdayDate,
  monthTitle,
  sessionTone,
  toDateKey,
  weekdayColumns,
  weekTitle
} from "./class-schedule-utils"

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
        <ClassScheduleLegend />
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
  return (
    <div className="content-border mt-5 p-3">
      <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-xl font-semibold capitalize text-brand-ink">{weekTitle(weekStart)}</h3>
          <p className="mt-1 text-xs font-semibold text-stone-500">{sessionsLength} buổi trong vùng lịch đang tải</p>
        </div>
        <ClassScheduleLegend />
      </div>
      <div className="grid gap-3 lg:grid-cols-7">
        {weekCells.map((date) => {
          const key = toDateKey(date)
          const daySessions = sessionsByDate[key] ?? []
          const dayEvents = eventsByDate[key] ?? []
          const weekday = weekdayColumns.find((day) => day.value === date.getDay())
          const isToday = key === defaultDate
          const isBlocked = dayEvents.some((event) => event.affectsScheduling)

          return (
            <div
              key={key}
              className={`rounded-3xl border border-brand-red/10 p-3 transition-colors lg:min-h-[28rem] ${
                isToday ? "bg-brand-red/5" : "bg-white/25"
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
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-red">{weekday?.short ?? ""}</p>
                  <p className="mt-1 text-lg font-semibold text-brand-ink">{formatWeekdayDate(date)}</p>
                </div>
                <span className="rounded-2xl border border-brand-red/10 px-2 py-1 text-[11px] font-semibold text-stone-600">
                  {daySessions.length} buổi
                </span>
              </div>
              <div className="space-y-2">
                {dayEvents.map((event) => (
                  <ScheduleEventBadge key={event.id} event={event} />
                ))}
                {isLoading ? <p className="rounded-2xl border border-brand-red/10 p-2 text-xs text-stone-400">Đang tải...</p> : null}
                {daySessions.map((session) => (
                  <CalendarSessionButton
                    key={session.id}
                    session={session}
                    canDrag={canManageSchedule && !isBlocked}
                    isDragging={draggingSessionId === session.id}
                    setDraggingSessionId={setDraggingSessionId}
                    setSelectedSession={setSelectedSession}
                  />
                ))}
                {!isLoading && !dayEvents.length && !daySessions.length ? (
                  <p className="rounded-2xl border border-brand-red/10 p-3 text-xs text-stone-500">Không có lịch.</p>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
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
