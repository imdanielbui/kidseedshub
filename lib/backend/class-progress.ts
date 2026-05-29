import type { ClassSessionStatus } from "@prisma/client"
import type { ClassProgressSummary } from "@/lib/contracts/class-progress"

type ClassProgressSource = {
  id: string
  name: string
  plannedSessions: number | null
  course: {
    name: string
    totalSessions: number
  }
  sessions: Array<{
    date: Date
    status: ClassSessionStatus
  }>
}

function endOfToday(now = new Date()) {
  const value = new Date(now)
  value.setHours(23, 59, 59, 999)
  return value
}

export function toClassProgressSummary(klass: ClassProgressSource, now = new Date()): ClassProgressSummary {
  const activeSessions = klass.sessions
    .filter((session) => session.status !== "CANCELED")
    .sort((first, second) => first.date.getTime() - second.date.getTime())
  const todayEnd = endOfToday(now)
  const currentSessionNumber = activeSessions.filter((session) => session.date <= todayEnd).length
  const totalSessions = klass.plannedSessions ?? klass.course.totalSessions ?? activeSessions.length
  const safeTotal = Math.max(0, totalSessions)
  const displayCurrent = safeTotal ? Math.min(currentSessionNumber, safeTotal) : currentSessionNumber
  const nextSession = activeSessions.find((session) => session.date > todayEnd)

  return {
    classId: klass.id,
    className: klass.name,
    courseName: klass.course.name,
    currentSessionNumber: displayCurrent,
    totalSessions: safeTotal,
    nextSessionDate: nextSession?.date.toISOString(),
    label: safeTotal ? `Buổi ${displayCurrent}/${safeTotal}` : `Buổi ${displayCurrent}`
  }
}
