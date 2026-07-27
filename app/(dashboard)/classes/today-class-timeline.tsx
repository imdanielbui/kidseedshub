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
  const timelineClasses = [...classes].sort((left, right) => minutesFromTime(left.startTime) - minutesFromTime(right.startTime) || left.id.localeCompare(right.id))

  return (
    <div className="max-h-[58vh] space-y-2 overflow-auto pr-1">
      {timelineClasses.map((klass) => {
        const marked = klass.students.filter((student) => student.attendanceStatus).length
        const selected = klass.id === selectedClassId

        return (
          <button
            key={klass.id}
            type="button"
            className={`w-full rounded-xl border px-3 py-2 text-left transition hover:shadow-md ${timelineTone(klass)} ${selected ? "ring-2 ring-brand-red/35 ring-offset-1" : ""}`}
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
  )
}
