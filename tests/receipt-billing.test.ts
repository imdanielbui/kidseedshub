import assert from "node:assert/strict"
import test from "node:test"
import { billingMonthLabel, billingMonthRange, countBillingPeriodSessions, parseBillingPeriod } from "../lib/backend/receipt-billing"

function utcDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`)
}

test("billingMonthLabel formats the tuition month label", () => {
  assert.equal(billingMonthLabel("2026-06"), "Học phí tháng 06/2026")
})

test("parseBillingPeriod rejects invalid ranges", () => {
  assert.throws(() => parseBillingPeriod({
    start: "2026-07-01T00:00:00.000Z",
    end: "2026-06-01T00:00:00.000Z"
  }), /INVALID_BILLING_PERIOD/)
})

test("countBillingPeriodSessions counts active class sessions inside month and after join date", async () => {
  const range = billingMonthRange("2026-06")
  const tx = {
    classStudent: {
      findFirst: async () => ({
        class: {
          sessions: [
            { date: utcDate("2026-06-01") },
            { date: utcDate("2026-06-08") },
            { date: utcDate("2026-06-15") }
          ]
        }
      })
    }
  }

  const result = await countBillingPeriodSessions(tx as unknown as Parameters<typeof countBillingPeriodSessions>[0], {
    id: "enrollment-1",
    studentId: "student-1",
    courseId: "course-1",
    startDate: utcDate("2026-06-08")
  }, range)

  assert.equal(result, 2)
})

test("countBillingPeriodSessions returns undefined when student is not in an active class", async () => {
  const range = billingMonthRange("2026-06")
  const tx = {
    classStudent: {
      findFirst: async () => null
    }
  }

  const result = await countBillingPeriodSessions(tx as unknown as Parameters<typeof countBillingPeriodSessions>[0], {
    id: "enrollment-1",
    studentId: "student-1",
    courseId: "course-1",
    startDate: utcDate("2026-06-01")
  }, range)

  assert.equal(result, undefined)
})
