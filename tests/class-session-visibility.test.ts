import assert from "node:assert/strict"
import test from "node:test"
import { filterSessionsOutsideBlockedDates } from "../lib/backend/class-session-visibility"

function localDate(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year, month - 1, day)
}

test("filterSessionsOutsideBlockedDates hides classes on blocked holiday dates", () => {
  const sessions = [
    { id: "blocked_sunday", date: localDate("2026-06-07") },
    { id: "moved_next_sunday", date: localDate("2026-06-14") },
    { id: "weekday_session", date: "2026-06-08" }
  ]

  const visibleSessions = filterSessionsOutsideBlockedDates(sessions, new Set(["2026-06-07"]))

  assert.deepEqual(visibleSessions.map((session) => session.id), ["moved_next_sunday", "weekday_session"])
})
