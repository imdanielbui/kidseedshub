import { z } from "zod"

const subjectKey = z.string().trim().toUpperCase().min(2).max(80).regex(/^[A-Z0-9_]+$/, "Mã bộ môn chỉ gồm chữ in hoa, số và dấu gạch dưới")

export const subjectCreateSchema = z.object({
  key: subjectKey,
  name: z.string().trim().min(2).max(120),
  sortOrder: z.number().int().min(0).max(9999).optional()
})

export const subjectUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional()
})
