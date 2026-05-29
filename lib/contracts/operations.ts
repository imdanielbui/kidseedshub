export type AuditLogItem = {
  id: string
  action: string
  entityType: string
  entityId?: string
  summary: string
  actorName: string
  createdAt: string
}

export type InternalNotificationItem = {
  id: string
  title: string
  body: string
  href?: string
  type: string
  isRead: boolean
  actorName?: string
  createdAt: string
}
