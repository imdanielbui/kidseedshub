import { dateKey } from "@/lib/backend/class-schedule"

type SessionWithDate = {
  date: Date | string
}

function sessionDateKey(value: Date | string) {
  return typeof value === "string" ? value.slice(0, 10) : dateKey(value)
}

export function filterSessionsOutsideBlockedDates<T extends SessionWithDate>(
  sessions: T[],
  blockedDateKeys: Set<string>
) {
  if (!blockedDateKeys.size) return sessions

  return sessions.filter((session) => !blockedDateKeys.has(sessionDateKey(session.date)))
}
