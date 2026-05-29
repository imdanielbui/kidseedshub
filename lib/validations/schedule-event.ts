import { z } from "zod"

export const scheduleEventCreateSchema = z.object({
  title: z.string().min(1).max(160),
  date: z.string().date(),
  type: z.enum(["HOLIDAY", "EVENT"]).default("HOLIDAY"),
  affectsScheduling: z.boolean().default(true),
  note: z.string().max(1000).optional()
})

export const scheduleEventUpdateSchema = scheduleEventCreateSchema.partial()

export const scheduleEventListQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional()
})
