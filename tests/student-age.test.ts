import assert from "node:assert/strict"
import test from "node:test"
import { formatAge } from "../app/(dashboard)/students/[id]/student-detail-format"

test("formatAge keeps the month until the birthday day arrives", () => {
  assert.equal(formatAge("2020-07-24", new Date(2026, 6, 23)), "5 tuổi 11 tháng")
})

test("formatAge resets the month count on the birthday", () => {
  assert.equal(formatAge("2020-07-23", new Date(2026, 6, 23)), "6 tuổi 0 tháng")
})

test("formatAge handles a child below one year old", () => {
  assert.equal(formatAge("2026-02-23", new Date(2026, 6, 23)), "5 tháng")
})
