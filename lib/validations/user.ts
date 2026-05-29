import { z } from "zod"
import { staffRoles } from "@/lib/contracts/users"

const emailSchema = z
  .string()
  .trim()
  .transform((value) => (value === "" ? undefined : value))
  .pipe(z.string().email().optional())

export const userCreateSchema = z.object({
  name: z.string().trim().min(1, "Tên người dùng là bắt buộc").max(160),
  phone: z.string().trim().min(8, "Số điện thoại không hợp lệ").max(24),
  email: emailSchema,
  password: z.string().min(6, "Mật khẩu cần ít nhất 6 ký tự"),
  role: z.enum(staffRoles),
  isActive: z.boolean().default(true)
})

export const userUpdateSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  phone: z.string().trim().min(8).max(24).optional(),
  email: emailSchema.nullable().optional(),
  password: z.string().min(6).optional(),
  role: z.enum(staffRoles).optional(),
  isActive: z.boolean().optional()
})
