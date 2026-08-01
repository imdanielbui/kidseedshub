import assert from "node:assert/strict"
import test from "node:test"
import { roboticsAgeGroupForAssessment } from "../lib/assessment-scoring"

test("robotics age group override is used when a birth date is unavailable", () => {
  assert.deepEqual(roboticsAgeGroupForAssessment({ override: "11-14" }), { ageGroup: "11-14", isDefault: false })
})

test("robotics age group falls back to the birth-date rule without an override", () => {
  assert.deepEqual(roboticsAgeGroupForAssessment({ birthDate: new Date(2015, 7, 1) }), { ageGroup: "11-14", isDefault: false })
})
