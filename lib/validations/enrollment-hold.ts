import { z } from "zod"

export const enrollmentHoldCreateSchema = z.object({
  enrollmentId: z.string().min(1),
  holdMonths: z.number().int().min(1).max(24),
  reason: z.string().trim().min(3).max(1000)
})

export const enrollmentHoldResumeSchema = z.object({
  classId: z.string().min(1)
})
