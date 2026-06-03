import assert from "node:assert/strict"
import test from "node:test"
import type { LoginAttemptLog } from "@/lib/backend/login-attempts"
import { loginAttemptStateFromLogs, loginLockoutMs, maxFailedLoginAttempts } from "@/lib/backend/login-attempts"

function log(action: string, phone: string, createdAtMs: number, lockedUntil?: number): LoginAttemptLog {
  return {
    action,
    createdAt: new Date(createdAtMs),
    metadata: {
      phone,
      ...(lockedUntil ? { lockedUntil: new Date(lockedUntil).toISOString() } : {})
    }
  }
}

test("loginAttemptStateFromLogs locks a phone after the configured failed-attempt threshold", () => {
  const phone = "0900000001"
  const now = new Date("2026-06-03T09:00:00.000Z")
  const logs = Array.from({ length: maxFailedLoginAttempts }, (_, index) => log("auth.login_failed", phone, now.getTime() - index * 1000))
  const state = loginAttemptStateFromLogs(phone, logs, now)

  assert.equal(state?.failedCount, maxFailedLoginAttempts)
  assert.equal(state?.lockedUntil, now.getTime() + loginLockoutMs)
})

test("loginAttemptStateFromLogs ignores failures before the latest successful login", () => {
  const phone = "0900000001"
  const now = new Date("2026-06-03T09:00:00.000Z")
  const logs = [
    log("auth.login_failed", phone, now.getTime() - 8_000),
    log("auth.login_failed", phone, now.getTime() - 7_000),
    log("auth.login_success", phone, now.getTime() - 6_000),
    log("auth.login_failed", phone, now.getTime() - 1_000)
  ]
  const state = loginAttemptStateFromLogs(phone, logs, now)

  assert.equal(state?.failedCount, 1)
  assert.equal(state?.lockedUntil, undefined)
})

test("loginAttemptStateFromLogs preserves an active persisted lockout", () => {
  const phone = "0900000001"
  const now = new Date("2026-06-03T09:00:00.000Z")
  const lockedUntil = now.getTime() + 60_000
  const state = loginAttemptStateFromLogs(phone, [log("auth.login_blocked", phone, now.getTime() - 1_000, lockedUntil)], now)

  assert.equal(state?.lockedUntil, lockedUntil)
})
