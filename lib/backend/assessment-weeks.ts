type AssessmentSession = {
  id: string
  date: Date
  status?: string
}

type AttendanceRecord = {
  classSessionId: string | null
  status: string
}

type SessionAttendance = {
  enrollmentId: string
  status: string
}

export function sessionsPerAssessmentWeek(scheduleSlots: Array<{ isActive: boolean }>) {
  return Math.max(1, scheduleSlots.filter((slot) => slot.isActive).length)
}

export function assessmentWeekGroups<T extends AssessmentSession>(sessions: T[], sessionsPerWeek: number) {
  const activeSessions = sessions
    .filter((session) => session.status !== "CANCELED")
    .sort((first, second) => first.date.getTime() - second.date.getTime())
  const groups: T[][] = []

  for (let index = 0; index < activeSessions.length; index += sessionsPerWeek) {
    groups.push(activeSessions.slice(index, index + sessionsPerWeek))
  }

  return groups
}

export function observedEnrollmentIdsForAssessmentWeek<T extends AssessmentSession & { attendances: SessionAttendance[] }>(input: {
  sessions: T[]
  scheduleSlots: Array<{ isActive: boolean }>
  weekNumber: number
}) {
  const weekSessions = assessmentWeekGroups(input.sessions, sessionsPerAssessmentWeek(input.scheduleSlots))[input.weekNumber - 1] ?? []

  return new Set(
    weekSessions.flatMap((session) =>
      session.attendances
        .filter((attendance) => attendance.status === "PRESENT")
        .map((attendance) => attendance.enrollmentId)
    )
  )
}

export function requiredAssessmentWeeksForEnrollment(input: {
  sessions: AssessmentSession[]
  scheduleSlots: Array<{ isActive: boolean }>
  attendances: AttendanceRecord[]
}) {
  const attendanceBySessionId = new Map(
    input.attendances
      .filter((attendance): attendance is AttendanceRecord & { classSessionId: string } => Boolean(attendance.classSessionId))
      .map((attendance) => [attendance.classSessionId, attendance.status])
  )
  const groups = assessmentWeekGroups(input.sessions, sessionsPerAssessmentWeek(input.scheduleSlots))

  return groups.filter((group) => group.some((session) => attendanceBySessionId.get(session.id) === "PRESENT")).length
}
