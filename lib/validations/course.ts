import { z } from "zod"

export const courseSubjects = ["FUN", "ROBOTICS"] as const

export const courseCreateSchema = z.object({
  name: z.string().min(1, "Tên khóa học là bắt buộc").max(160),
  subject: z.enum(courseSubjects),
  description: z.string().max(1000).optional(),
  totalSessions: z.number().int().min(1).max(200),
  price: z.number().nonnegative(),
  isActive: z.boolean().default(true)
})

export const courseUpdateSchema = courseCreateSchema.partial()

export const classScheduleSlotSchema = z.object({
  id: z.string().optional(),
  weekday: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  room: z.string().max(120).optional(),
  isActive: z.boolean().default(true)
})

export const classCreateSchema = z.object({
  code: z.string().max(160).optional(),
  name: z.string().min(1, "Tên lớp là bắt buộc").max(160),
  courseId: z.string().min(1),
  teacherId: z.string().min(1),
  weekday: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  room: z.string().max(120).optional(),
  startDate: z.string().date().optional(),
  plannedSessions: z.number().int().min(1).max(200).optional(),
  isActive: z.boolean().default(true),
  scheduleSlots: z.array(classScheduleSlotSchema).optional(),
  studentIds: z.array(z.string()).default([])
})

export const classUpdateSchema = classCreateSchema.omit({ studentIds: true }).partial()

export const classListQuerySchema = z.object({
  active: z.enum(["true", "false"]).optional()
})

export const classSessionListQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional()
})

export const classSessionUpdateSchema = z.object({
  date: z.string().date().optional(),
  status: z.enum(["SCHEDULED", "CANCELED", "COMPLETED"]).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  room: z.string().max(120).nullable().optional(),
  substituteTeacherId: z.string().nullable().optional()
})

export const classStudentsUpdateSchema = z.object({
  studentIds: z.array(z.string().min(1))
})
