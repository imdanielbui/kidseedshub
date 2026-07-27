"use client"

import type { Dispatch, SetStateAction } from "react"
import type { ClassCalendarSessionItem } from "@/lib/contracts/courses"
import type { ScheduleEventItem } from "@/lib/contracts/schedule-events"
import { defaultDate, formatWeekdayDate, sessionTone, toDateKey, weekdayColumns } from "./class-schedule-utils"

type WeeklyTimeGridProps = {
  weekCells: Date[]
  sessionsByDate: Record<string, ClassCalendarSessionItem[]>
  eventsByDate: Record<string, ScheduleEventItem[]>
  isLoading: boolean
  canManageSchedule: boolean
  draggingSessionId: string | null
  setDraggingSessionId: Dispatch<SetStateAction<string | null>>
  setSelectedSession: Dispatch<SetStateAction<ClassCalendarSessionItem | null>>
  dropSessionOnDate: (date: Date) => void
}

const startHour = 8
const endHour = 21
const pixelsPerHour = 72

function minutesFromTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number)
  return hours * 60 + minutes
}

function layoutSessions(sessions: ClassCalendarSessionItem[]) {
  let activeSessions: Array<{ end: number }> = []
  const positioned = sessions
    .slice()
    .sort((first, second) => minutesFromTime(first.startTime) - minutesFromTime(second.startTime) || first.id.localeCompare(second.id))
    .map((session) => {
      const start = minutesFromTime(session.startTime)
      const end = Math.max(start + 40, minutesFromTime(session.endTime))
      activeSessions = activeSessions.filter((activeSession) => activeSession.end > start)
      const stackLevel = activeSessions.length
      activeSessions.push({ end })
      return { session, start, end, stackLevel }
    })

  return positioned
}

export function WeeklyTimeGrid({
  weekCells,
  sessionsByDate,
  eventsByDate,
  isLoading,
  canManageSchedule,
  draggingSessionId,
  setDraggingSessionId,
  setSelectedSession,
  dropSessionOnDate
}: WeeklyTimeGridProps) {
  const gridHeight = (endHour - startHour) * pixelsPerHour
  const now = new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const currentTimeTop = ((nowMinutes - startHour * 60) / 60) * pixelsPerHour

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[980px]">
        <div className="grid grid-cols-[56px_repeat(7,minmax(130px,1fr))] border-b border-l border-brand-red/10">
          <div className="border-r border-t border-brand-red/10 bg-white/40" />
          {weekCells.map((date) => {
            const key = toDateKey(date)
            const weekday = weekdayColumns.find((day) => day.value === date.getDay())
            const isToday = key === defaultDate
            const events = eventsByDate[key] ?? []
            return (
              <div key={key} className={`min-h-20 border-r border-t border-brand-red/10 px-2 py-2 ${isToday ? "bg-brand-red/5" : "bg-white/35"}`}>
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-red">{weekday?.short}</p>
                <p className="mt-1 text-sm font-semibold text-brand-ink">{formatWeekdayDate(date)}</p>
                {events.map((event) => <p key={event.id} className={`mt-1 truncate rounded px-1.5 py-1 text-[10px] font-semibold ${event.affectsScheduling ? "bg-brand-red text-white" : "bg-amber-100 text-amber-700"}`}>{event.title}</p>)}
              </div>
            )
          })}
        </div>
        <div className="grid grid-cols-[56px_repeat(7,minmax(130px,1fr))] border-l border-brand-red/10">
          <div className="relative border-r border-brand-red/10" style={{ height: `${gridHeight}px` }}>
            {Array.from({ length: endHour - startHour + 1 }, (_, index) => startHour + index).map((hour) => (
              <span key={hour} className="absolute right-2 -translate-y-1/2 text-[10px] font-semibold text-stone-400" style={{ top: `${(hour - startHour) * pixelsPerHour}px` }}>{String(hour).padStart(2, "0")}:00</span>
            ))}
          </div>
          {weekCells.map((date) => {
            const key = toDateKey(date)
            const sessions = sessionsByDate[key] ?? []
            const sessionLayout = layoutSessions(sessions)
            const isToday = key === defaultDate
            const blocked = (eventsByDate[key] ?? []).some((event) => event.affectsScheduling)
            return (
              <div
                key={key}
                className={`relative border-r border-brand-red/10 ${isToday ? "bg-brand-red/5" : "bg-white/15"} ${blocked ? "bg-brand-red/5" : ""}`}
                style={{ height: `${gridHeight}px`, backgroundImage: `repeating-linear-gradient(to bottom, transparent, transparent ${pixelsPerHour - 1}px, rgba(165,36,39,0.10) ${pixelsPerHour - 1}px, rgba(165,36,39,0.10) ${pixelsPerHour}px)` }}
                onDragOver={(event) => {
                  if (!canManageSchedule || blocked) return
                  event.preventDefault()
                }}
                onDrop={(event) => {
                  if (blocked) return
                  event.preventDefault()
                  dropSessionOnDate(date)
                }}
              >
                {isLoading ? <span className="absolute left-2 top-2 text-xs text-stone-400">Đang tải...</span> : null}
                {isToday && nowMinutes >= startHour * 60 && nowMinutes <= endHour * 60 ? (
                  <div className="absolute left-0 right-0 z-20 flex items-center" style={{ top: `${currentTimeTop}px` }}>
                    <span className="-ml-1 h-2 w-2 rounded-full bg-brand-red" />
                    <span className="h-px flex-1 bg-brand-red/70" />
                  </div>
                ) : null}
                {sessionLayout.map(({ session, start: sessionStart, end: sessionEnd, stackLevel }) => {
                  const start = Math.max(startHour * 60, sessionStart)
                  const end = Math.min(endHour * 60, sessionEnd)
                  const top = ((start - startHour * 60) / 60) * pixelsPerHour
                  const height = Math.max(48, ((Math.max(end - start, 40)) / 60) * pixelsPerHour)
                  return (
                    <button
                      key={session.id}
                      type="button"
                      draggable={canManageSchedule && !blocked}
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/plain", session.id)
                        setDraggingSessionId(session.id)
                      }}
                      onDragEnd={() => setDraggingSessionId(null)}
                      onClick={() => setSelectedSession(session)}
                      className={`absolute overflow-hidden rounded-lg border px-2 py-1.5 text-left text-[11px] font-semibold shadow-sm transition hover:shadow-md ${sessionTone(session)} ${draggingSessionId === session.id ? "opacity-60" : ""}`}
                      style={{
                        top: `${top}px`,
                        minHeight: `${height}px`,
                        left: `${stackLevel * 8 + 3}px`,
                        right: "3px",
                        zIndex: 10 + stackLevel
                      }}
                    >
                      <span className="block truncate">{session.startTime}-{session.endTime}</span>
                      <span className="mt-0.5 block line-clamp-2">{session.className}</span>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
