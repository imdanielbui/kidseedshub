import { z } from "zod"

export const enrollmentTransferCreateSchema = z.object({
  fromEnrollmentId: z.string().min(1),
  toCourseId: z.string().min(1),
  toClassId: z.string().min(1).optional(),
  startDate: z.string().datetime().optional(),
  reason: z.string().trim().min(3).max(1000)
})
