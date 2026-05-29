import { z } from "zod"

export const tuitionReminderQuerySchema = z.object({
  threshold: z.coerce.number().int().min(0).max(20).default(2),
  templateId: z.enum(["TUITION_LOW_SESSIONS", "TRIAL_FOLLOW_UP", "RENEWAL_CONFIRMATION"]).default("TUITION_LOW_SESSIONS")
})

export const tuitionReminderQueueSchema = z.object({
  enrollmentId: z.string().min(1),
  templateId: z.enum(["TUITION_LOW_SESSIONS", "TRIAL_FOLLOW_UP", "RENEWAL_CONFIRMATION"]).default("TUITION_LOW_SESSIONS")
})
