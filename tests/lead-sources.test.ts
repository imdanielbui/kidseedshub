import assert from "node:assert/strict"
import test from "node:test"
import { normalizeLeadSourceOptions } from "../lib/backend/lead-sources"

test("normalizeLeadSourceOptions returns unique trimmed lead sources for create-lead options", () => {
  const sources = normalizeLeadSourceOptions([
    { leadSource: " Facebook Ads " },
    { leadSource: "facebook ads" },
    { leadSource: null },
    { leadSource: "" },
    { leadSource: "Zalo OA" },
    { leadSource: "Walk-in" }
  ])

  assert.deepEqual(sources, ["Facebook Ads", "Walk-in", "Zalo OA"])
})
