"use client"

import { Clock3 } from "lucide-react"
import type { Dispatch, SetStateAction } from "react"
import type { TodayClassItem } from "@/lib/contracts/classes"

type TodayClassTimelineProps = {
  classes: TodayClassItem[]
  selectedClassId: string | undefined
  setSelectedClassId: Dispatch<SetStateAction<string>>
  setExpandedStudentId: Dispatch<SetStateAction<string | null>>
}

const startHour = 8
const endHour = 21
const pixelsPerHour = 54

function minutesFromTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number)
  return hours * 60 + minutes
}

function timelineTone(klass: TodayClassItem) {
  const marked = klass.students.filter((student) => student.attendanceStatus).length
  if (marked === klass.students.length && marked > 0) return "border-emerald-500/35 bg-emerald-50 text-emerald-900"
  if (marked > 0) return "border-amber-400/40 bg-amber-50 text-amber-900"

  const now = new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  if (nowMinutes > minutesFromTime(klass.endTime)) return "border-brand-red/25 bg-brand-red/5 text-brand-red"
  if (nowMinutes >= minutesFromTime(klass.startTime)) return "border-brand-red/35 bg-white text-brand-red shadow-sm"
  return "border-stone-200 bg-white/65 text-stone-700"
}

export function TodayClassTimeline({ classes, selectedClassId, setSelectedClassId, setExpandedStudentId }: TodayClassTimelineProps) {
  const now = new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const timelineMinutes = (endHour - startHour) * 60
  const nowTop = ((nowMinutes - startHour * 60) / timelineMinutes) * (endHour - startHour) * pixelsPerHour

  return (
    <div className="max-h-[58vh] overflow-auto pr-1">
      <div className="relative min-w-[250px]" style={{ height: `${(endHour - startHour) * pixelsPerHour}px` }}>
        <div className="absolute bottom-0 left-10 top-0 border-l border-brand-red/15" />
        {Array.from({ length: endHour - startHour + 1 }, (_, index) => startHour + index).map((hour) => (
          <div key={hour} className="absolute left-0 right-0 flex items-start gap-2" style={{ top: `${(hour - startHour) * pixelsPerHour}px` }}>
            <span className="w-8 text-right text-[10px] font-semibold text-stone-400">{String(hour).padStart(2, "0")}:00</span>
            <span className="mt-1 h-px flex-1 bg-brand-red/10" />
          </div>
        ))}
        {nowMinutes >= startHour * 60 && nowMinutes <= endHour * 60 ? (
          <div className="absolute left-10 right-0 z-10 flex items-center gap-2" style={{ top: `${nowTop}px` }}>
            <span className="h-2 w-2 rounded-full bg-brand-red" />
            <span className="h-px flex-1 bg-brand-red/60" />
            <span className="rounded-full bg-brand-red px-2 py-0.5 text-[10px] font-semibold text-white">Bây giờ</span>
          </div>
        ) : null}
        {classes.map((klass) => {
          const start = Math.max(startHour * 60, minutesFromTime(klass.startTime))
          const end = Math.min(endHour * 60, minutesFromTime(klass.endTime))
          const top = ((start - startHour * 60) / 60) * pixelsPerHour
          const height = Math.max(46, ((Math.max(end - start, 45)) / 60) * pixelsPerHour)
          const marked = klass.students.filter((student) => student.attendanceStatus).length
          const selected = klass.id === selectedClassId

          return (
            <button
              key={klass.id}
              type="button"
              className={`absolute left-14 right-0 z-20 rounded-xl border px-3 py-2 text-left transition hover:shadow-md ${timelineTone(klass)} ${selected ? "ring-2 ring-brand-red/35 ring-offset-1" : ""}`}
              style={{ top: `${top}px`, minHeight: `${height}px` }}
              onClick={() => {
                setSelectedClassId(klass.id)
                setExpandedStudentId(null)
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="line-clamp-2 text-xs font-semibold">{klass.name}</span>
                <span className="shrink-0 text-[10px] font-semibold">{marked}/{klass.students.length}</span>
              </div>
              <span className="mt-1 flex items-center gap-1 text-[10px] opacity-80"><Clock3 className="h-3 w-3" />{klass.startTime}-{klass.endTime}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
