import type { Prisma } from "@prisma/client"
import type { AuditLogItem, InternalNotificationItem } from "@/lib/contracts/operations"

type Tx = Prisma.TransactionClient

export function toAuditLogItem(log: {
  id: string
  action: string
  entityType: string
  entityId: string | null
  summary: string
  createdAt: Date
  actor: { name: string } | null
}): AuditLogItem {
  return {
    id: log.id,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId ?? undefined,
    summary: log.summary,
    actorName: log.actor?.name ?? "System",
    createdAt: log.createdAt.toISOString()
  }
}

export function toInternalNotificationItem(notification: {
  id: string
  title: string
  body: string
  href: string | null
  type: string
  isRead: boolean
  createdAt: Date
  actor: { name: string } | null
}): InternalNotificationItem {
  return {
    id: notification.id,
    title: notification.title,
    body: notification.body,
    href: notification.href ?? undefined,
    type: notification.type,
    isRead: notification.isRead,
    actorName: notification.actor?.name ?? undefined,
    createdAt: notification.createdAt.toISOString()
  }
}

export async function createAuditLog(
  tx: Tx,
  input: {
    actorId?: string
    action: string
    entityType: string
    entityId?: string
    summary: string
    metadata?: Prisma.InputJsonValue
  }
) {
  return tx.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      summary: input.summary,
      metadata: input.metadata
    }
  })
}

export async function notifyUsers(
  tx: Tx,
  input: {
    recipientIds: string[]
    actorId?: string
    title: string
    body: string
    href?: string
    type: string
  }
) {
  const uniqueRecipientIds = Array.from(new Set(input.recipientIds)).filter((id) => id !== input.actorId)

  if (!uniqueRecipientIds.length) {
    return { count: 0 }
  }

  return tx.internalNotification.createMany({
    data: uniqueRecipientIds.map((recipientId) => ({
      recipientId,
      actorId: input.actorId,
      title: input.title,
      body: input.body,
      href: input.href,
      type: input.type
    }))
  })
}

export async function getActiveStaffRecipientIds(tx: Tx, roles: Array<"ADMIN" | "SALE" | "TEACHER"> = ["ADMIN"]) {
  const users = await tx.user.findMany({
    where: {
      isActive: true,
      role: { in: roles }
    },
    select: { id: true }
  })

  return users.map((user) => user.id)
}
