import assert from "node:assert/strict"
import test from "node:test"
import { can } from "../lib/permissions"

test("photo publish permission is limited to admin and sale", () => {
  assert.equal(can("ADMIN", "photos:publish"), true)
  assert.equal(can("SALE", "photos:publish"), true)
  assert.equal(can("TEACHER", "photos:publish"), false)
  assert.equal(can("PARENT", "photos:publish"), false)
})

test("teacher can still upload photo drafts", () => {
  assert.equal(can("TEACHER", "photos:upload"), true)
})
