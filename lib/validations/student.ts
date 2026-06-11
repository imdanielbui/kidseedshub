import { z } from "zod"

export const studentStatuses = ["LEAD", "TRIAL", "EVALUATION", "CONVERTED", "RETENTION", "NURTURE", "ACTIVE", "INACTIVE", "GRADUATED"] as const
export const studentGenders = ["MALE", "FEMALE", "OTHER", "UNKNOWN"] as const

export const studentCreateSchema = z.object({
  name: z.string().min(1, "Tên học viên là bắt buộc"),
  birthDate: z.string().datetime().optional(),
  address: z.string().max(500).optional(),
  status: z.enum(studentStatuses).default("LEAD"),
  gender: z.enum(studentGenders).default("UNKNOWN"),
  leadSource: z.string().max(80).optional(),
  leadNote: z.string().max(1000).optional(),
  healthNote: z.string().max(1000).optional(),
  assignedTeacherId: z.string().optional(),
  saleOwnerId: z.string().optional(),
  classId: z.string().optional(),
  parent: z.object({
    name: z.string().min(1, "Tên phụ huynh là bắt buộc"),
    phone: z.string().min(8, "Số điện thoại phụ huynh không hợp lệ"),
    email: z.string().email().optional()
  })
})

export const studentUpdateSchema = z.object({
  name: z.string().min(1, "Tên học viên là bắt buộc").optional(),
  birthDate: z.string().datetime().nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  status: z.enum(studentStatuses).optional(),
  gender: z.enum(studentGenders).optional(),
  leadSource: z.string().max(80).nullable().optional(),
  leadNote: z.string().max(1000).nullable().optional(),
  healthNote: z.string().max(1000).nullable().optional(),
  assignedTeacherId: z.string().nullable().optional(),
  saleOwnerId: z.string().nullable().optional(),
  parent: z
    .object({
      name: z.string().min(1, "Tên phụ huynh là bắt buộc").optional(),
      phone: z.string().min(8, "Số điện thoại phụ huynh không hợp lệ").optional(),
      email: z.string().email().nullable().optional()
    })
    .optional()
})

export const studentListQuerySchema = z.object({
  status: z.enum(studentStatuses).optional(),
  classId: z.string().optional(),
  q: z.string().optional(),
  sort: z.enum(["updatedAt", "createdAt", "code", "name", "parentName", "sessionsRemaining"]).default("updatedAt"),
  direction: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
})
