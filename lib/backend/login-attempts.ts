import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"

export type LoginAttemptState = {
  failedCount: number
  firstFailedAt: number
  lockedUntil?: number
}

export type LoginAttemptLog = {
  action: string
  createdAt: Date
  metadata: Prisma.JsonValue | null
}

export const loginAttemptWindowMs = 15 * 60 * 1000
export const loginLockoutMs = 15 * 60 * 1000
export const maxFailedLoginAttempts = 5

const loginAttemptActions = ["auth.login_failed", "auth.login_blocked", "auth.login_success"] as const
const loginAttemptLookbackMs = loginAttemptWindowMs + loginLockoutMs

function metadataRecord(metadata: Prisma.JsonValue | null) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return undefined
  }

  return metadata as Record<string, Prisma.JsonValue>
}

function metadataPhone(metadata: Prisma.JsonValue | null) {
  const value = metadataRecord(metadata)?.phone
  return typeof value === "string" ? value : undefined
}

function metadataLockedUntil(metadata: Prisma.JsonValue | null) {
  const value = metadataRecord(metadata)?.lockedUntil
  return typeof value === "string" ? Date.parse(value) : undefined
}

export function loginAttemptStateFromLogs(phone: string, logs: LoginAttemptLog[], now = new Date()): LoginAttemptState | undefined {
  const relevantLogs = logs
    .filter((log) => metadataPhone(log.metadata) === phone)
    .sort((first, second) => second.createdAt.getTime() - first.createdAt.getTime())

  const activeBlock = relevantLogs.find((log) => log.action === "auth.login_blocked" && (metadataLockedUntil(log.metadata) ?? 0) > now.getTime())

  if (activeBlock) {
    return {
      failedCount: maxFailedLoginAttempts,
      firstFailedAt: activeBlock.createdAt.getTime(),
      lockedUntil: metadataLockedUntil(activeBlock.metadata)
    }
  }

  const latestSuccessAt = relevantLogs.find((log) => log.action === "auth.login_success")?.createdAt.getTime()
  const windowStart = now.getTime() - loginAttemptWindowMs
  const failedLogs = relevantLogs
    .filter((log) => log.action === "auth.login_failed")
    .filter((log) => log.createdAt.getTime() >= windowStart)
    .filter((log) => !latestSuccessAt || log.createdAt.getTime() > latestSuccessAt)

  if (!failedLogs.length) {
    return undefined
  }

  const firstFailedAt = Math.min(...failedLogs.map((log) => log.createdAt.getTime()))
  const failedCount = failedLogs.length

  return {
    failedCount,
    firstFailedAt,
    lockedUntil: failedCount >= maxFailedLoginAttempts ? now.getTime() + loginLockoutMs : undefined
  }
}

async function loadRecentLoginAttemptLogs(phone: string, now = new Date()) {
  const since = new Date(now.getTime() - loginAttemptLookbackMs)
  const logs = await prisma.auditLog.findMany({
    where: {
      action: { in: [...loginAttemptActions] },
      createdAt: { gte: since }
    },
    select: {
      action: true,
      createdAt: true,
      metadata: true
    },
    orderBy: { createdAt: "desc" },
    take: 500
  })

  return logs.filter((log) => metadataPhone(log.metadata) === phone)
}

export async function getLoginAttemptState(phone: string) {
  return loginAttemptStateFromLogs(phone, await loadRecentLoginAttemptLogs(phone))
}

export async function recordFailedLogin(phone: string, userId?: string) {
  const now = new Date()

  await prisma.auditLog.create({
    data: {
      action: "auth.login_failed",
      entityType: userId ? "User" : "Auth",
      entityId: userId,
      summary: "Credential login failed.",
      metadata: { phone }
    }
  })

  return loginAttemptStateFromLogs(phone, await loadRecentLoginAttemptLogs(phone, now), now)
}

export async function recordBlockedLogin(phone: string, lockedUntil: number, userId?: string) {
  await prisma.auditLog.create({
    data: {
      action: "auth.login_blocked",
      entityType: userId ? "User" : "Auth",
      entityId: userId,
      summary: "Credential login blocked after repeated failed attempts.",
      metadata: { phone, lockedUntil: new Date(lockedUntil).toISOString() }
    }
  })
}

export async function recordSuccessfulLogin(phone: string, userId: string) {
  await prisma.auditLog.create({
    data: {
      action: "auth.login_success",
      entityType: "User",
      entityId: userId,
      summary: "Credential login succeeded.",
      metadata: { phone }
    }
  })
}
