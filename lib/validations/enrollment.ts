import { z } from "zod"

export const enrollmentCreateSchema = z.object({
  studentId: z.string().min(1),
  courseId: z.string().min(1),
  classId: z.string().min(1).optional(),
  sessionsBought: z.number().int().min(0).max(200).default(0),
  joinSessionNumber: z.number().int().min(1).max(200).optional(),
  totalCourseSessionsAtJoin: z.number().int().min(1).max(200).optional(),
  freeTrialSessions: z.number().int().min(0).max(200).default(0),
  paidSessionsBeforeReceipt: z.number().int().min(0).max(200).default(0),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional()
})

export const enrollmentUpdateSchema = z.object({
  classId: z.string().min(1).nullable().optional(),
  sessionsBought: z.number().int().min(0).max(200).optional(),
  sessionsUsed: z.number().int().min(0).max(200).optional(),
  joinSessionNumber: z.number().int().min(1).max(200).optional(),
  totalCourseSessionsAtJoin: z.number().int().min(1).max(200).optional(),
  freeTrialSessions: z.number().int().min(0).max(200).optional(),
  paidSessionsBeforeReceipt: z.number().int().min(0).max(200).optional(),
  startDate: z.string().datetime().nullable().optional(),
  endDate: z.string().datetime().nullable().optional(),
  isActive: z.boolean().optional()
})
