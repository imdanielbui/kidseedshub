import assert from "node:assert/strict"
import test from "node:test"
import { getClassTimelineAttendanceState } from "../lib/modules/classes/class-timeline"

function localDate(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year, month - 1, day)
}

test("class timeline marks canceled and future sessions without requiring attendance", () => {
  assert.equal(getClassTimelineAttendanceState({
    sessionDate: localDate("2026-06-10"),
    sessionStatus: "CANCELED",
    attendanceMarked: 0,
    attendanceExpected: 8,
    now: localDate("2026-06-20")
  }), "CANCELED")

  assert.equal(getClassTimelineAttendanceState({
    sessionDate: localDate("2026-06-21"),
    sessionStatus: "SCHEDULED",
    attendanceMarked: 0,
    attendanceExpected: 8,
    now: localDate("2026-06-20")
  }), "UPCOMING")
})

test("class timeline distinguishes pending, partial, and fully marked sessions", () => {
  const base = {
    sessionDate: localDate("2026-06-20"),
    sessionStatus: "SCHEDULED" as const,
    attendanceExpected: 4,
    now: localDate("2026-06-20")
  }

  assert.equal(getClassTimelineAttendanceState({ ...base, attendanceMarked: 0 }), "PENDING")
  assert.equal(getClassTimelineAttendanceState({ ...base, attendanceMarked: 2 }), "PARTIAL")
  assert.equal(getClassTimelineAttendanceState({ ...base, attendanceMarked: 4 }), "COMPLETE")
})
