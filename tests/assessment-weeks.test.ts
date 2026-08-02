import assert from "node:assert/strict"
import test from "node:test"
import { assessmentWeekGroups, observedEnrollmentIdsForAssessmentWeek, requiredAssessmentWeeksForEnrollment, sessionsPerAssessmentWeek } from "@/lib/backend/assessment-weeks"

const sessions = Array.from({ length: 16 }, (_, index) => ({
  id: `session-${index + 1}`,
  date: new Date(2026, 5, index + 1),
  status: "SCHEDULED"
}))

test("assessment week groups sessions by active weekly schedule slots", () => {
  const groups = assessmentWeekGroups(sessions, sessionsPerAssessmentWeek([{ isActive: true }, { isActive: true }]))

  assert.equal(groups.length, 8)
  assert.deepEqual(groups.map((group) => group.length), Array.from({ length: 8 }, () => 2))
})

test("a fully absent week does not require a weekly assessment for final-report eligibility", () => {
  const attendances = sessions.map((session, index) => ({
    classSessionId: session.id,
    status: index === 6 || index === 7 ? "ABSENT_EXCUSED" : "PRESENT"
  }))

  assert.equal(
    requiredAssessmentWeeksForEnrollment({
      sessions,
      scheduleSlots: [{ isActive: true }, { isActive: true }],
      attendances
    }),
    7
  )
})

test("one attended session in a week still requires one weekly assessment", () => {
  const attendances = sessions.map((session, index) => ({
    classSessionId: session.id,
    status: index === 6 ? "ABSENT_EXCUSED" : "PRESENT"
  }))

  assert.equal(
    requiredAssessmentWeeksForEnrollment({
      sessions,
      scheduleSlots: [{ isActive: true }, { isActive: true }],
      attendances
    }),
    8
  )
})

test("only students present in a learning week are eligible for its assessment", () => {
  const sessionsWithAttendance = sessions.map((session, index) => ({
    ...session,
    attendances: index === 2 || index === 3
      ? [{ enrollmentId: "student-a", status: "ABSENT_EXCUSED" }, { enrollmentId: "student-b", status: "PRESENT" }]
      : [{ enrollmentId: "student-a", status: "PRESENT" }, { enrollmentId: "student-b", status: "PRESENT" }]
  }))

  assert.deepEqual(
    [...observedEnrollmentIdsForAssessmentWeek({
      sessions: sessionsWithAttendance,
      scheduleSlots: [{ isActive: true }, { isActive: true }],
      weekNumber: 2
    })],
    ["student-b"]
  )
})
