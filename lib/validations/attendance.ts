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
  studentId: z.string().min(1).optional(),
  classSessionId: z.string().min(1).optional(),
  attendanceId: z.string().min(1).optional(),
  url: z.string().url(),
  caption: z.string().max(1000).optional(),
  takenAt: z.string().datetime().optional(),
  isPublished: z.boolean().default(false),
  isFeatured: z.boolean().default(false)
}).refine((value) => value.studentId || value.classSessionId || value.attendanceId, {
  message: "Ảnh cần gắn với buổi học, học viên hoặc điểm danh."
})

export const classPhotoUpdateSchema = z.object({
  caption: z.string().max(1000).nullable().optional(),
  isFeatured: z.boolean().optional(),
  isPublished: z.boolean().optional(),
  markSent: z.boolean().optional()
})

export const classPhotoListQuerySchema = z.object({
  studentId: z.string().min(1).optional(),
  classSessionId: z.string().min(1).optional(),
  attendanceId: z.string().min(1).optional()
})

export const makeupScheduleUpdateSchema = z.object({
  makeupDate: z.string().datetime().nullable()
})
