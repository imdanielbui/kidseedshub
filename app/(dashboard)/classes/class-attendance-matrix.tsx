"use client"

import { useMemo } from "react"
import { Check, Circle, Clock3, Minus, X } from "lucide-react"
import type { AttendanceStatusKey, ClassTimelineItem, ClassTimelineSession, ClassTimelineStudent } from "@/lib/contracts/classes"

type ClassAttendanceMatrixProps = {
  timeline: ClassTimelineItem
  onSelectAttendance: (selection: ClassAttendanceDetailSelection) => void
}

type MatrixStudent = ClassTimelineStudent & {
  studentCode?: string
}

export type ClassAttendanceDetailSelection = {
  session: ClassTimelineSession
  student: ClassTimelineStudent
}

const attendanceCellMeta: Record<AttendanceStatusKey, { label: string; className: string; iconClassName: string; icon: typeof Check }> = {
  PRESENT: { label: "Có mặt", className: "bg-emerald-50 hover:bg-emerald-100", iconClassName: "text-emerald-600", icon: Check },
  ABSENT_EXCUSED: { label: "Nghỉ phép", className: "bg-amber-50 hover:bg-amber-100", iconClassName: "text-amber-600", icon: Clock3 },
  ABSENT_NO_EXCUSE: { label: "Vắng", className: "bg-brand-red/5 hover:bg-brand-red/10", iconClassName: "text-brand-red", icon: X }
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit" }).format(new Date(`${value}T12:00:00`))
}

function sessionCellClass(session: ClassTimelineSession, student?: MatrixStudent) {
  if (!student) return "border-transparent bg-transparent text-transparent"
  if (student.attendanceStatus) return attendanceCellMeta[student.attendanceStatus].className
  if (session.attendanceState === "CANCELED") return "bg-stone-50 text-stone-300"
  if (session.attendanceState === "UPCOMING") return "bg-stone-50/70 text-stone-300 hover:bg-stone-100"
  return "bg-stone-50 text-stone-400 hover:bg-stone-100"
}

function sessionCellLabel(session: ClassTimelineSession, student?: MatrixStudent) {
  if (!student) return "Chưa thuộc roster buổi này"
  if (student.attendanceStatus) return attendanceCellMeta[student.attendanceStatus].label
  if (session.attendanceState === "CANCELED") return "Buổi đã hủy"
  if (session.attendanceState === "UPCOMING") return "Buổi sắp diễn ra"
  return "Chưa điểm danh"
}

export function ClassAttendanceMatrix({ timeline, onSelectAttendance }: ClassAttendanceMatrixProps) {
  const students = useMemo(() => {
    const byId = new Map<string, MatrixStudent>()

    for (const session of timeline.sessions) {
      for (const student of session.students) {
        if (!byId.has(student.studentId)) byId.set(student.studentId, student)
      }
    }

    return [...byId.values()].sort((first, second) => first.studentName.localeCompare(second.studentName, "vi"))
  }, [timeline.sessions])
  const attendanceBySession = useMemo(
    () => new Map(timeline.sessions.map((session) => [session.id, new Map(session.students.map((student) => [student.studentId, student]))])),
    [timeline.sessions]
  )

  return (
    <section className="border-b border-brand-red/10">
      <div className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold text-brand-ink">Sổ điểm danh theo buổi</p>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-medium text-stone-600">
          <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-emerald-500" />Có mặt</span>
          <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-amber-400" />Nghỉ phép</span>
          <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-brand-red" />Vắng</span>
          <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full border border-stone-300" />Chưa điểm danh</span>
        </div>
      </div>

      {students.length ? (
        <div className="max-h-[48vh] overflow-auto border-t border-brand-red/10">
          <table className="min-w-max border-separate border-spacing-0 text-left text-xs">
            <thead className="sticky top-0 z-20 bg-[#fffaf7]">
              <tr>
                <th className="sticky left-0 z-30 min-w-[230px] border-b border-r border-brand-red/10 bg-[#fffaf7] px-4 py-3 font-semibold text-brand-ink">Học viên</th>
                {timeline.sessions.map((session) => (
                  <th key={session.id} className={`min-w-[76px] border-b border-r border-brand-red/10 px-2 py-2 text-center ${session.attendanceState === "CANCELED" ? "bg-stone-50 text-stone-400" : "bg-[#fffaf7] text-brand-ink"}`}>
                    <span className="block text-[11px] font-semibold">Buổi {session.sessionNumber}</span>
                    <span className="mt-0.5 block text-[10px] font-medium opacity-75">{session.attendanceState === "CANCELED" ? "Đã hủy" : shortDate(session.date)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.studentId}>
                  <th scope="row" className="sticky left-0 z-10 border-b border-r border-brand-red/10 bg-[#fffdfb] px-4 py-2.5 font-normal">
                    <p className="truncate font-semibold text-brand-ink">{student.studentName}</p>
                    <p className="mt-0.5 truncate text-[11px] text-stone-500">{student.studentCode ?? student.parentName}</p>
                  </th>
                  {timeline.sessions.map((session) => {
                    const sessionStudent = attendanceBySession.get(session.id)?.get(student.studentId)
                    const label = sessionCellLabel(session, sessionStudent)

                    return (
                      <td key={session.id} className="border-b border-r border-brand-red/10 p-1.5 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            if (!sessionStudent) return
                            onSelectAttendance({ session, student: sessionStudent })
                          }}
                          disabled={!sessionStudent}
                          title={`${student.studentName} - Buổi ${session.sessionNumber}: ${label}`}
                          aria-label={`${student.studentName} - Buổi ${session.sessionNumber}: ${label}`}
                          className={`grid h-8 w-full min-w-14 place-items-center rounded-lg transition disabled:cursor-default ${sessionCellClass(session, sessionStudent)}`}
                        >
                          {sessionStudent ? <AttendanceCellIcon session={session} student={sessionStudent} /> : null}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mx-5 mb-5 rounded-2xl border border-brand-red/10 p-4 text-sm text-stone-500">Chưa có học viên active trong các buổi đã sinh của lớp.</p>
      )}
    </section>
  )
}

function AttendanceCellIcon({ session, student }: { session: ClassTimelineSession; student: MatrixStudent }) {
  if (student.attendanceStatus) {
    const meta = attendanceCellMeta[student.attendanceStatus]
    const Icon = meta.icon
    return <Icon className={`h-3.5 w-3.5 ${meta.iconClassName}`} aria-hidden="true" />
  }

  if (session.attendanceState === "CANCELED") return <Minus className="h-3.5 w-3.5" aria-hidden="true" />
  if (session.attendanceState === "UPCOMING") return <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
  return <Circle className="h-3.5 w-3.5" aria-hidden="true" />
}
