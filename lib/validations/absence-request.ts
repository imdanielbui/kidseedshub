import { z } from "zod"

export const absenceRequestCreateSchema = z.object({
  studentId: z.string().min(1),
  classSessionId: z.string().min(1),
  reason: z.string().min(3).max(600)
})

export const absenceRequestUpdateSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  adminNote: z.string().max(600).optional()
})

export const absenceRequestListQuerySchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional()
})
