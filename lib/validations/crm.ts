import { z } from "zod"
import { studentStatuses } from "@/lib/validations/student"

export const contactResults = ["INTERESTED", "NEED_TIME", "REJECTED", "CONVERTED", "NO_ANSWER"] as const
export const taskStatuses = ["PENDING", "DONE", "OVERDUE"] as const

export const studentStatusUpdateSchema = z.object({
  status: z.enum(studentStatuses)
})

export const contactLogCreateSchema = z.object({
  content: z.string().min(1, "Nội dung liên hệ là bắt buộc").max(2000),
  result: z.enum(contactResults)
})

export const taskCreateSchema = z.object({
  title: z.string().min(1, "Tiêu đề task là bắt buộc").max(200),
  note: z.string().max(1000).optional(),
  dueDate: z.string().datetime(),
  studentId: z.string().optional(),
  assignedToId: z.string().optional()
})

export const taskListQuerySchema = z.object({
  assignedTo: z.enum(["me"]).optional(),
  status: z.enum(taskStatuses).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
})

export const taskUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  note: z.string().max(1000).nullable().optional(),
  dueDate: z.string().datetime().optional(),
  status: z.enum(taskStatuses).optional(),
  assignedToId: z.string().optional()
})
