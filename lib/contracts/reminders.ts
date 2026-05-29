import type { ZaloTemplateKey } from "@/lib/message-templates"

export type ZaloTemplateItem = {
  id: ZaloTemplateKey
  name: string
  category: "TUITION" | "CRM" | "RENEWAL"
  body: string
}

export type TuitionReminderItem = {
  enrollmentId: string
  studentId: string
  studentName: string
  parentName: string
  parentPhone: string
  courseName: string
  sessionsBought: number
  sessionsUsed: number
  sessionsRemaining: number
  lastReceiptAt?: string
  templateId: ZaloTemplateKey
  message: string
}

export type QueuedTuitionReminder = {
  taskId: string
  enrollmentId: string
  studentId: string
  message: string
}
