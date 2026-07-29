"use client"

import { useMemo } from "react"
import type { AttendanceStatusKey, ClassTimelineItem, ClassTimelineSession, ClassTimelineStudent } from "@/lib/contracts/classes"

type ClassAttendanceMatrixProps = {
  timeline: ClassTimelineItem
  selectedSessionId: string | null
  onSelectSession: (sessionId: string) => void
  onSelectAttendance: (selection: ClassAttendanceDetailSelection) => void
}

type MatrixStudent = ClassTimelineStudent & {
  studentCode?: string
}

export type ClassAttendanceDetailSelection = {
  session: ClassTimelineSession
  student: ClassTimelineStudent
}

const attendanceCellMeta: Record<AttendanceStatusKey, { label: string; className: string }> = {
  PRESENT: { label: "Có mặt", className: "border-emerald-600 bg-emerald-500 text-white hover:bg-emerald-600" },
  ABSENT_EXCUSED: { label: "Nghỉ phép", className: "border-amber-400 bg-amber-300 text-amber-950 hover:bg-amber-400" },
  ABSENT_NO_EXCUSE: { label: "Vắng", className: "border-brand-red bg-brand-red text-white hover:bg-brand-red/90" }
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit" }).format(new Date(`${value}T12:00:00`))
}

function sessionCellClass(session: ClassTimelineSession, student?: MatrixStudent) {
  if (!student) return "border-transparent bg-transparent text-transparent"
  if (student.attendanceStatus) return attendanceCellMeta[student.attendanceStatus].className
  if (session.attendanceState === "CANCELED") return "border-stone-200 bg-stone-100 text-stone-400"
  if (session.attendanceState === "UPCOMING") return "border-stone-200 bg-white/70 text-stone-400"
  return "border-brand-red/20 bg-brand-red/5 text-brand-red hover:bg-brand-red/10"
}

function sessionCellLabel(session: ClassTimelineSession, student?: MatrixStudent) {
  if (!student) return "Chưa thuộc roster buổi này"
  if (student.attendanceStatus) return attendanceCellMeta[student.attendanceStatus].label
  if (session.attendanceState === "CANCELED") return "Buổi đã hủy"
  if (session.attendanceState === "UPCOMING") return "Buổi sắp diễn ra"
  return "Chưa điểm danh"
}

export function ClassAttendanceMatrix({ timeline, selectedSessionId, onSelectSession, onSelectAttendance }: ClassAttendanceMatrixProps) {
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
      <div className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-brand-ink">Sổ điểm danh theo buổi</p>
          <p className="mt-1 text-xs text-stone-500">Chọn một ô để xem chi tiết buổi học. Cột buổi cuộn ngang, danh sách học viên luôn được ghim.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
          <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />Có mặt</span>
          <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-amber-300" />Nghỉ phép</span>
          <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-brand-red" />Vắng</span>
          <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm border border-brand-red/25 bg-brand-red/5" />Chưa điểm danh</span>
        </div>
      </div>

      {students.length ? (
        <div className="max-h-[48vh] overflow-auto border-t border-brand-red/10">
          <table className="min-w-max border-separate border-spacing-0 text-left text-xs">
            <thead className="sticky top-0 z-20 bg-[#fffaf7]">
              <tr>
                <th className="sticky left-0 z-30 min-w-[230px] border-b border-r border-brand-red/10 bg-[#fffaf7] px-4 py-3 font-semibold text-brand-ink">Học viên</th>
                {timeline.sessions.map((session) => (
                  <th key={session.id} className="min-w-[76px] border-b border-r border-brand-red/10 bg-[#fffaf7] px-2 py-2 text-center">
                    <button type="button" onClick={() => onSelectSession(session.id)} className={`w-full rounded-lg px-1 py-1.5 transition ${selectedSessionId === session.id ? "bg-brand-red text-white" : "text-brand-ink hover:bg-brand-red/5"}`}>
                      <span className="block text-[11px] font-semibold">Buổi {session.sessionNumber}</span>
                      <span className="mt-0.5 block text-[10px] font-medium opacity-80">{shortDate(session.date)}</span>
                    </button>
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
                            onSelectSession(session.id)
                            onSelectAttendance({ session, student: sessionStudent })
                          }}
                          disabled={!sessionStudent}
                          title={`${student.studentName} - Buổi ${session.sessionNumber}: ${label}`}
                          aria-label={`${student.studentName} - Buổi ${session.sessionNumber}: ${label}`}
                          className={`grid h-9 w-full min-w-14 place-items-center rounded-md border text-[10px] font-semibold transition disabled:cursor-default ${sessionCellClass(session, sessionStudent)}`}
                        >
                          {sessionStudent ? sessionStudent.attendanceStatus ? attendanceCellMeta[sessionStudent.attendanceStatus].label : session.attendanceState === "CANCELED" ? "Hủy" : session.attendanceState === "UPCOMING" ? "-" : "?" : ""}
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
