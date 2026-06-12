import type { ClassSessionStatus, Prisma } from "@prisma/client"

type Tx = Prisma.TransactionClient

type SessionDateInput = {
  date: Date
  status: ClassSessionStatus
}

function startOfDay(value: Date) {
  const result = new Date(value)
  result.setHours(0, 0, 0, 0)
  return result
}

export function calculateJoinSessionNumberFromDates(sessions: SessionDateInput[], startDate?: Date | null) {
  const activeSessions = sessions
    .filter((session) => session.status !== "CANCELED")
    .sort((first, second) => first.date.getTime() - second.date.getTime())

  if (!activeSessions.length || !startDate) {
    return 1
  }

  const start = startOfDay(startDate).getTime()
  const index = activeSessions.findIndex((session) => startOfDay(session.date).getTime() >= start)

  return index === -1 ? activeSessions.length + 1 : index + 1
}

export async function calculateJoinSessionNumberForClass(tx: Tx, input: { classId?: string | null; startDate?: Date | null }) {
  if (!input.classId) {
    return 1
  }

  const sessions = await tx.classSession.findMany({
    where: { classId: input.classId },
    select: { date: true, status: true },
    orderBy: { date: "asc" }
  })

  return calculateJoinSessionNumberFromDates(sessions, input.startDate)
}
