import { z } from "zod"

export const tuitionReminderQuerySchema = z.object({
  threshold: z.coerce.number().int().min(0).max(20).default(2),
  billingMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  templateId: z.enum(["TUITION_LOW_SESSIONS", "TRIAL_FOLLOW_UP", "RENEWAL_CONFIRMATION"]).default("TUITION_LOW_SESSIONS")
})

export const tuitionReminderQueueSchema = z.object({
  enrollmentId: z.string().min(1),
  billingMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  templateId: z.enum(["TUITION_LOW_SESSIONS", "TRIAL_FOLLOW_UP", "RENEWAL_CONFIRMATION"]).default("TUITION_LOW_SESSIONS")
})
