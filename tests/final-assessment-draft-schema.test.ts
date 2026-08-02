import test from "node:test"
import assert from "node:assert/strict"
import { finalClassPublishSchema } from "@/lib/validations/assessment"

test("final classroom report defaults to publish for existing callers", () => {
  const parsed = finalClassPublishSchema.parse({ classId: "class-1", requiredWeeks: 16 })

  assert.equal(parsed.mode, "PUBLISH")
})

test("final classroom report accepts a draft save request", () => {
  const parsed = finalClassPublishSchema.parse({ classId: "class-1", requiredWeeks: 16, studentId: "student-1", mode: "DRAFT" })

  assert.equal(parsed.mode, "DRAFT")
  assert.equal(parsed.studentId, "student-1")
})
