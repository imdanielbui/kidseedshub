import assert from "node:assert/strict"
import test from "node:test"
import { calculateJoinSessionNumberFromDates } from "../lib/backend/enrollment-join-session"

function localDate(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year, month - 1, day)
}

test("calculateJoinSessionNumberFromDates returns first session when student joins before class starts", () => {
  const result = calculateJoinSessionNumberFromDates([
    { date: localDate("2026-06-10"), status: "SCHEDULED" },
    { date: localDate("2026-06-17"), status: "SCHEDULED" }
  ], localDate("2026-06-01"))

  assert.equal(result, 1)
})

test("calculateJoinSessionNumberFromDates uses the first active session on or after the join date", () => {
  const result = calculateJoinSessionNumberFromDates([
    { date: localDate("2026-06-03"), status: "SCHEDULED" },
    { date: localDate("2026-06-10"), status: "SCHEDULED" },
    { date: localDate("2026-06-17"), status: "SCHEDULED" }
  ], localDate("2026-06-11"))

  assert.equal(result, 3)
})

test("calculateJoinSessionNumberFromDates ignores canceled sessions", () => {
  const result = calculateJoinSessionNumberFromDates([
    { date: localDate("2026-06-03"), status: "SCHEDULED" },
    { date: localDate("2026-06-10"), status: "CANCELED" },
    { date: localDate("2026-06-17"), status: "SCHEDULED" }
  ], localDate("2026-06-10"))

  assert.equal(result, 2)
})

test("calculateJoinSessionNumberFromDates falls back to first session without generated class sessions", () => {
  assert.equal(calculateJoinSessionNumberFromDates([], localDate("2026-06-10")), 1)
  assert.equal(calculateJoinSessionNumberFromDates([
    { date: localDate("2026-06-10"), status: "CANCELED" }
  ], localDate("2026-06-10")), 1)
})
