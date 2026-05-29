import { z } from "zod"

export const attendanceStatuses = ["PRESENT", "ABSENT_EXCUSED", "ABSENT_NO_EXCUSE"] as const

export const attendanceCreateSchema = z.object({
  enrollmentId: z.string().min(1),
  classSessionId: z.string().optional(),
  date: z.string().datetime(),
  status: z.enum(attendanceStatuses),
  note: z.string().max(2000).optional(),
  makeupDate: z.string().datetime().optional()
})

export const classPhotoCreateSchema = z.object({
  studentId: z.string().min(1),
  attendanceId: z.string().min(1).optional(),
  url: z.string().url(),
  takenAt: z.string().datetime().optional(),
  isFeatured: z.boolean().default(false)
})

export const classPhotoListQuerySchema = z.object({
  studentId: z.string().min(1).optional(),
  attendanceId: z.string().min(1).optional()
})

export const makeupScheduleUpdateSchema = z.object({
  makeupDate: z.string().datetime().nullable()
})
