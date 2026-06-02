import { z } from "zod"

export const staffLeaveTypes = ["PAID", "UNPAID", "SICK", "OTHER"] as const
export const staffLeaveStatuses = ["PENDING", "APPROVED", "REJECTED", "CANCELED"] as const

export const staffLeaveCreateSchema = z.object({
  staffId: z.string().min(1).optional(),
  startDate: z.string().date(),
  endDate: z.string().date(),
  type: z.enum(staffLeaveTypes),
  reason: z.string().min(3).max(1000)
})

export const staffLeaveUpdateSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED", "CANCELED"]),
  adminNote: z.string().max(1000).optional()
})

export const staffLeaveListQuerySchema = z.object({
  status: z.enum(staffLeaveStatuses).optional(),
  staffId: z.string().min(1).optional()
})
